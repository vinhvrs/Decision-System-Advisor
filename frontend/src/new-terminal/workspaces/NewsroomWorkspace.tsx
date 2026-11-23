"use client";

import Link from "next/link";
import { useState } from "react";
import { sourceLink, type News } from "../feeds";
import { SymbolContext } from "../ContextBadges";
import { useFeed } from "../useFeed";

type NewsPayload = {
  data: News[];
  current_page?: number;
  last_page?: number;
  total?: number;
};

function excerpt(item: News) {
  const raw = (item.content ?? "").replace(/\s+/g, " ").trim();
  if (!raw) return "Full article text is not available from this source.";
  const withoutTitle = raw.startsWith(item.title) ? raw.slice(item.title.length).trim() : raw;
  const withoutReadMore = withoutTitle.replace(/Read more:\s*https?:\/\/\S+\s*$/i, "").trim();
  return withoutReadMore.length > 520 ? `${withoutReadMore.slice(0, 517).trim()}…` : withoutReadMore;
}

function articleMeta(item: News) {
  return [item.author || item.publisher, item.published_at, item.category].filter(Boolean).join(" · ");
}

export default function NewsroomWorkspace({
  initialNews = [],
  initialLastPage = 1,
  initialTotal = 0,
}: {
  initialNews?: News[];
  initialLastPage?: number;
  initialTotal?: number;
}) {
  const [page, setPage] = useState(1);
  const feed = useFeed<NewsPayload>(`/api/news?per_page=18&page=${page}`);
  const rows = (feed.data?.data ?? initialNews).filter(item => item.title?.trim());
  const lastPage = feed.data?.last_page ?? initialLastPage;
  const total = feed.data?.total ?? initialTotal;

  return (
    <div className="nt-workspace nt-newsroom-workspace">
      <section className="nt-context-strip" data-layout-key="newsroom:summary">
        <div className="nt-context-title">
          <div className="nt-label nt-info">News / Research Feed</div>
          <h1>Market Newsroom</h1>
        </div>
        <div className="nt-news-stat"><span>ARTICLES</span><b>{rows.length}</b></div>
        <div className="nt-news-stat"><span>INDEXED</span><b>{total || "—"}</b></div>
        <div className="nt-news-stat"><span>PAGE</span><b>{page}</b></div>
      </section>

      <section className="nt-newsroom-grid" aria-label="Market news articles">
        {rows.map((item, index) => {
          const image = sourceLink(item.image ?? undefined);
          const external = sourceLink(item.source);
          return (
            <article
              className={`nt-news-article ${index === 0 ? "nt-news-featured" : ""}`}
              data-layout-key={`news:${item.id}`}
              key={item.id}
            >
              {image && (
                <Link className="nt-news-media" href={`/news/${encodeURIComponent(item.id)}`}>
                  <img
                    src={image}
                    alt=""
                    loading={index < 3 ? "eager" : "lazy"}
                    referrerPolicy="no-referrer"
                    onError={event => {
                      const media = event.currentTarget.closest<HTMLElement>(".nt-news-media");
                      if (media) media.style.display = "none";
                    }}
                  />
                </Link>
              )}
              <div className="nt-news-article-body">
                <div className="nt-news-kicker">
                  <SymbolContext symbol={item.symbol} />
                  <span>{articleMeta(item)}</span>
                </div>
                <h2><Link href={`/news/${encodeURIComponent(item.id)}`}>{item.title}</Link></h2>
                <p>{excerpt(item)}</p>
                <div className="nt-news-article-footer">
                  <span>{item.content_status ? item.content_status.replace(/_/g, " ") : "indexed"}</span>
                  {item.word_count ? <span>{item.word_count.toLocaleString("en-US")} words</span> : null}
                  <Link href={`/news/${encodeURIComponent(item.id)}`}>Read article</Link>
                  {external && <a href={external} rel="noreferrer">Source ↗</a>}
                </div>
              </div>
            </article>
          );
        })}
        {!rows.length && <div className="nt-database-note">No indexed news articles are currently available.</div>}
      </section>

      <div className="nt-toolbar nt-news-pager" data-layout-key="newsroom:pager">
        <button type="button" disabled={page <= 1} onClick={() => setPage(value => Math.max(1, value - 1))}>Previous</button>
        <span>Page {page}{lastPage ? ` / ${lastPage}` : ""}</span>
        <button type="button" disabled={page >= lastPage} onClick={() => setPage(value => Math.min(lastPage, value + 1))}>Next</button>
      </div>
    </div>
  );
}

export function NewsArticleWorkspace({ article }: { article: News }) {
  const image = sourceLink(article.image ?? undefined);
  const external = sourceLink(article.source);
  const paragraphs = (article.content ?? "")
    .split(/\n+/)
    .map(value => value.trim())
    .filter(Boolean)
    .filter(value => !/^Read more:\s*https?:\/\//i.test(value));

  return (
    <div className="nt-workspace nt-news-article-workspace">
      <section className="nt-context-strip" data-layout-key="news-article:summary">
        <div className="nt-context-title">
          <div className="nt-label nt-info">News / Article</div>
          <h1>{article.symbol || article.category || "Market research"}</h1>
        </div>
        <div className="nt-news-stat"><span>PUBLISHED</span><b>{article.published_at?.slice(0, 16) || "—"}</b></div>
        <div className="nt-news-stat"><span>SOURCE</span><b>{article.author || article.publisher || "—"}</b></div>
      </section>

      <article className="nt-news-reader nt-panel" data-layout-key={`news-reader:${article.id}`}>
        {image && <img className="nt-news-reader-image" src={image} alt="" referrerPolicy="no-referrer" onError={event => { event.currentTarget.style.display = "none"; }} />}
        <div className="nt-news-reader-body">
          <div className="nt-news-kicker"><SymbolContext symbol={article.symbol} /><span>{articleMeta(article)}</span></div>
          <h1>{article.title}</h1>
          <div className="nt-news-reader-copy">
            {paragraphs.length ? paragraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>) : <p>Article text is unavailable from this source.</p>}
          </div>
          <div className="nt-news-article-footer">
            {external && <a href={external} rel="noreferrer">Open original source ↗</a>}
            <Link href="/news">Back to News</Link>
          </div>
        </div>
      </article>
    </div>
  );
}
