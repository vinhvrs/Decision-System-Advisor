<?php

namespace Platform\Plugins\Trading\Src\Services;
use GuzzleHttp\Client;

class NewsFetchService
{
    protected $googleNewsUrl;

    public function __construct()
    {
        $this->googleNewsUrl = env('GOOGLE_NEWS', 'news.google.com/rss');
    }

    public function fetchLatestNews($query, $maxResults = 10)
    {
        $client = new Client();

        $response = $client->get($this->googleNewsUrl, [
            'verify' => false,
            'query' => [
                'q' => $query,
                'hl' => 'en-US',
                'gl' => 'US',
                'ceid' => 'US:en'
            ]
        ]);

        $rssContent = $response->getBody()->getContents();
        $xml = simplexml_load_string($rssContent);
        $namespaces = $xml->getNamespaces(true);

        $newsItems = [];
        foreach ($xml->channel->item as $item) {
            if (count($newsItems) >= $maxResults) {
                break;
            }

            $newsItems[] = [
                'title' => (string) $item->title,
                'link' => (string) $item->link,
                'pubDate' => (string) $item->pubDate,
                'description' => (string) $item->title,
                'source' => (string) $item->source,
            ];
        }

        return $newsItems;
    }

    public function fetchByKeyword($keyword, $maxResults = 10)
    {
        return $this->fetchLatestNews($keyword, $maxResults);
    }

    public function storeNewsItems($newsItems, $knowledgeRepository)
    {
        foreach ($newsItems as $news) {
            $knowledgeRepository->nonDuplicateInsert([
                'topic' => $news['title'],
                'content' => $news['description'],
                'url_slug' => $news['link'],
                'published_at' => date('Y-m-d H:i:s', strtotime($news['pubDate'])),
                'author' => $news['source'] ?? 'Unknown',
            ]);
        }
    }

}