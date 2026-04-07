import logging
from app.data_collect.collectors.news_crawler import db_conn

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def run_migration():
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            logger.info("Reading legacy knowledge rows (skip rows with author)...")
            cur.execute("""
                SELECT id, topic, content, url_slug, created_at, updated_at
                FROM knowledge
                WHERE author IS NULL OR TRIM(author) = ''
            """)
            old_articles = cur.fetchall()

            if not old_articles:
                logger.info("Nothing to migrate.")
                return

            logger.info("Migrating %s row(s) to knowledge_docs...", len(old_articles))

            success_count = 0

            insert_query = """
                INSERT IGNORE INTO knowledge_docs
                (id, title, content, image, category, source, language, created_at, updated_at, is_processed)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """

            for row in old_articles:
                title = str(row['topic'])[:500] if row['topic'] else "Untitled"
                source = str(row['url_slug'])[:500] if row['url_slug'] else f"migrated_{row['id']}"

                raw_content = str(row['content']) if row['content'] else ""
                image_url = None
                clean_content = raw_content

                if raw_content.strip().startswith("Image URL:"):
                    parts = raw_content.split('\n', 1)
                    image_url = parts[0].replace("Image URL:", "").strip()[:1000]
                    clean_content = parts[1].strip() if len(parts) > 1 else ""

                cur.execute(insert_query, (
                    row['id'],
                    title,
                    clean_content,
                    image_url,
                    'article',
                    source,
                    'en',
                    row['created_at'],
                    row['updated_at'],
                    0
                ))

                if cur.rowcount > 0:
                    success_count += 1

            conn.commit()
            logger.info("Migrated %s/%s row(s).", success_count, len(old_articles))

    except Exception as e:
        conn.rollback()
        logger.error("Migration error: %s", e)
    finally:
        conn.close()

if __name__ == "__main__":
    run_migration()
