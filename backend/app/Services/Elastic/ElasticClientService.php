<?php

namespace App\Services\Elastic;

use Elasticsearch\Client;
use Elasticsearch\ClientBuilder;

class ElasticClientService
{
    protected Client $client;

    public function __construct()
    {
        $this->client = ClientBuilder::create()
            ->setHosts(config('elasticsearch.hosts'))
            ->build();
    }

    public function client(): Client
    {
        return $this->client;
    }
}