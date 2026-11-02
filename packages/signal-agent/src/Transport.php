<?php

namespace Signal\Agent;

use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Http;
use Throwable;

class Transport
{
    public function __construct(protected string $url, protected string $token, protected float $timeout)
    {
        //
    }

    /**
     * Post one batch to the dashboard. Never throws: monitoring must not break the app.
     *
     * @param  array<string, mixed>  $payload
     */
    public function send(array $payload): ?Response
    {
        try {
            return Http::withToken($this->token)
                ->acceptJson()
                ->connectTimeout(min(2, $this->timeout))
                ->timeout($this->timeout)
                ->post(rtrim($this->url, '/').'/api/ingest', $payload);
        } catch (Throwable) {
            return null;
        }
    }
}
