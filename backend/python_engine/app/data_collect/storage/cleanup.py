import logging
import re
from app.data_collect.collectors.news_crawler import db_conn

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def normalize_data():
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            # 1) Company dictionary
            cur.execute("SELECT symbol, company_name FROM company_profile")
            companies = cur.fetchall()

            company_mapping = {}
            for c in companies:
                sym = c['symbol']
                name = c['company_name']
                short_name = name.split(' ')[0].replace(',', '') if name else ""
                company_mapping[sym] = short_name

            # 2) Rows missing symbol
            cur.execute("SELECT id, title, content FROM knowledge_docs WHERE symbol IS NULL")
            docs = cur.fetchall()

            if not docs:
                logger.info("No articles missing symbol.")
                return

            logger.info("Normalizing %s article(s)...", len(docs))
            update_count = 0
            match_symbol_count = 0

            # Use re.IGNORECASE instead of inline (?i)
            prefix_pattern = re.compile(r'^news\s*:\s*', re.IGNORECASE)

            # 3) Scan and update
            for doc in docs:
                doc_id = doc['id']
                original_title = str(doc['title']) if doc['title'] else ""
                content = str(doc['content']) if doc['content'] else ""

                clean_title = prefix_pattern.sub('', original_title).strip()

                combined_text = clean_title + " \n " + content
                found_symbol = None

                for sym, short_name in company_mapping.items():
                    if re.search(rf'\b{sym}\b', combined_text):
                        found_symbol = sym
                        break

                    if short_name and re.search(rf'\b{re.escape(short_name)}\b', combined_text, re.IGNORECASE):
                        found_symbol = sym
                        break

                cur.execute("""
                    UPDATE knowledge_docs
                    SET title = %s, symbol = %s
                    WHERE id = %s
                """, (clean_title, found_symbol, doc_id))

                if found_symbol:
                    match_symbol_count += 1
                update_count += 1

                if update_count % 2000 == 0:
                    logger.info("Progress %s/%s", update_count, len(docs))

            conn.commit()
            logger.info("Cleaned titles for %s row(s).", update_count)
            logger.info("Assigned symbol on %s/%s row(s).", match_symbol_count, update_count)

    except Exception as e:
        conn.rollback()
        logger.error("Normalize failed: %s", e)
    finally:
        conn.close()

if __name__ == "__main__":
    normalize_data()
