"""Parser and dedupe tests. No network: every input is a fixture.

The parsers are the layer most likely to break silently when an API changes
shape, so they are tested against saved payloads.
"""
from app import sources

ARXIV_ATOM = """<?xml version='1.0' encoding='UTF-8'?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <entry>
    <id>http://arxiv.org/abs/2611.00001v1</id>
    <published>2026-11-05T18:00:00Z</published>
    <title>Graph Neural Networks for
      Protein Structure Prediction</title>
    <summary>We present a   method for folding.</summary>
    <author><name>A. Researcher</name></author>
    <author><name>B. Coauthor</name></author>
    <category term="q-bio.BM"/>
    <link title="doi" href="http://dx.doi.org/10.1234/abcd"/>
  </entry>
  <entry>
    <id>http://arxiv.org/abs/2611.00002v1</id>
    <published>2026-11-04T10:00:00Z</published>
    <title>Unrelated Work on Galaxies</title>
    <summary>Astronomy.</summary>
    <author><name>C. Astronomer</name></author>
    <category term="astro-ph.GA"/>
  </entry>
</feed>"""

CROSSREF_JSON = {
    "message": {
        "items": [
            {
                "DOI": "10.5555/xyz",
                "title": ["Cryo-EM   Structures of a Channel"],
                "abstract": "<jats:p>We resolved the structure.</jats:p>",
                "author": [{"given": "D.", "family": "Biologist"}],
                "container-title": ["Advances in Theoretical &amp; Computation"],
                "URL": "https://doi.org/10.5555/xyz",
                "published": {"date-parts": [[2026, 10, 30]]},
            },
            {
                # No DOI: must be skipped, not crash.
                "title": ["Record With No DOI"],
                "container-title": ["Nature"],
            },
            {
                # Partial date: must still parse.
                "DOI": "10.5555/partial",
                "title": ["Partial Date Paper"],
                "container-title": ["Science"],
                "issued": {"date-parts": [[2026, 9]]},
            },
        ]
    }
}


def test_parse_arxiv_extracts_fields_and_collapses_whitespace():
    papers = sources.parse_arxiv_atom(ARXIV_ATOM)
    assert len(papers) == 2
    first = papers[0]
    assert first["title"] == "Graph Neural Networks for Protein Structure Prediction"
    assert first["abstract"] == "We present a method for folding."
    assert first["authors"] == ["A. Researcher", "B. Coauthor"]
    assert first["source"] == "arxiv"
    assert first["doi"] == "10.1234/abcd"
    assert "q-bio.BM" in first["venue"]


def test_parse_crossref_decodes_entities_strips_tags_and_skips_doiless():
    papers = sources.parse_crossref(CROSSREF_JSON)
    # the DOI-less record is dropped
    assert len(papers) == 2
    first = papers[0]
    assert first["title"] == "Cryo-EM Structures of a Channel"
    assert first["venue"] == "Advances in Theoretical & Computation"  # entity decoded
    assert "<jats:p>" not in first["abstract"]
    assert first["published_at"] == "2026-10-30"
    # a year-month-only date is padded, not dropped
    assert papers[1]["published_at"] == "2026-09-01"


def test_build_arxiv_query_is_quote_free():
    """Quoted phrases make export.arxiv.org answer 429, so never emit them."""
    q = sources.build_arxiv_query(["cs.LG", "q-bio.BM"], ["protein folding"])
    assert '"' not in q
    assert q == "cat:cs.LG OR cat:q-bio.BM"
    # with no categories it falls back to unquoted single words
    q2 = sources.build_arxiv_query([], ["protein folding"])
    assert '"' not in q2
    assert "all:protein" in q2


def test_dedupe_collapses_versioned_dois_with_same_title():
    """eLife and friends mint a DOI per version of the same paper."""
    papers = [
        {"title": "Improved cryo-EM reconstruction", "doi": "10.7554/elife.1", "source": "crossref"},
        {"title": "Improved cryo-EM reconstruction", "doi": "10.7554/elife.2", "source": "crossref"},
    ]
    assert len(sources.dedupe(papers)) == 1


def test_dedupe_prefers_published_version_over_preprint():
    papers = [
        {"title": "Same Paper", "doi": "10.1/x", "source": "arxiv", "venue": "arXiv preprint"},
        {"title": "Same Paper", "doi": "10.1/x", "source": "crossref", "venue": "Nature"},
    ]
    out = sources.dedupe(papers)
    assert len(out) == 1
    assert out[0]["source"] == "crossref"
    assert out[0]["venue"] == "Nature"


def test_dedupe_keeps_genuinely_different_papers():
    papers = [
        {"title": "Paper One", "doi": "10.1/a", "source": "crossref"},
        {"title": "Paper Two", "doi": "10.1/b", "source": "crossref"},
    ]
    assert len(sources.dedupe(papers)) == 2


def test_within_lookback_rejects_future_dated_records():
    """Crossref carries records dated years ahead; they are junk, not news."""
    papers = [
        {"title": "Future junk", "published_at": "2029-10-01"},
        {"title": "Real", "published_at": sources.cutoff_date(1).strftime("%Y-%m-%d")},
        {"title": "Undated", "published_at": ""},
    ]
    kept = {p["title"] for p in sources.within_lookback(papers, 7)}
    assert "Future junk" not in kept
    assert "Undated" in kept  # undated papers are kept, not silently dropped


def test_within_lookback_drops_papers_older_than_window():
    papers = [{"title": "Old", "published_at": "2020-01-01"}]
    assert sources.within_lookback(papers, 7) == []
