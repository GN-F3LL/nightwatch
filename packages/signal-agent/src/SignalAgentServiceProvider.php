<?php

namespace Signal\Agent;

use Illuminate\Console\Events\CommandStarting;
use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Contracts\Debug\ExceptionHandler;
use Illuminate\Foundation\Http\Events\RequestHandled;
use Illuminate\Log\Events\MessageLogged;
use Illuminate\Queue\Events\JobFailed;
use Illuminate\Queue\Events\JobProcessed;
use Illuminate\Queue\Events\JobProcessing;
use Illuminate\Queue\Events\JobReleasedAfterException;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\ServiceProvider;
use Signal\Agent\Commands\ReportCommand;
use Signal\Agent\Commands\TestCommand;
use Throwable;

class SignalAgentServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        $this->mergeConfigFrom(__DIR__.'/../config/signal-agent.php', 'signal-agent');

        $this->app->singleton(Transport::class, fn () => new Transport(
            (string) config('signal-agent.url'),
            (string) config('signal-agent.token'),
            (float) config('signal-agent.timeout'),
        ));

        $this->app->singleton(Spool::class, fn () => new Spool(
            config('signal-agent.spool_path'),
            (int) config('signal-agent.max_spool_bytes'),
        ));

        $this->app->singleton(ExceptionSerializer::class, fn ($app) => new ExceptionSerializer($app->basePath()));
        $this->app->singleton(HostInfo::class);
        $this->app->singleton(Recorder::class);
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        if ($this->app->runningInConsole()) {
            $this->publishes([__DIR__.'/../config/signal-agent.php' => config_path('signal-agent.php')], 'signal-agent-config');

            $this->commands([ReportCommand::class, TestCommand::class]);
        }

        if (! $this->isConfigured()) {
            return;
        }

        $this->registerExceptionReporting();
        $this->registerListeners();

        $this->callAfterResolving(Schedule::class, function (Schedule $schedule) {
            if (config('signal-agent.schedule')) {
                $schedule->command('signal:report')->everyMinute()->withoutOverlapping(5)->runInBackground();
            }
        });

        $this->app->terminating(function () {
            $this->safely(fn () => $this->app->make(Recorder::class)->persist());
        });
    }

    protected function isConfigured(): bool
    {
        return config('signal-agent.enabled') && config('signal-agent.url') && config('signal-agent.token');
    }

    protected function registerExceptionReporting(): void
    {
        $this->callAfterResolving(ExceptionHandler::class, function ($handler) {
            if (method_exists($handler, 'reportable')) {
                $handler->reportable(function (Throwable $e) {
                    $this->app->make(Recorder::class)->recordException($e);
                });
            }
        });
    }

    protected function registerListeners(): void
    {
        $recorder = fn (): Recorder => $this->app->make(Recorder::class);

        Event::listen(MessageLogged::class, fn (MessageLogged $e) => $this->safely(
            fn () => $recorder()->recordLog($e->level, $e->message, $e->context)
        ));

        Event::listen(RequestHandled::class, fn (RequestHandled $e) => $this->safely(
            fn () => $recorder()->recordRequest($e->request, $e->response)
        ));

        Event::listen(CommandStarting::class, fn (CommandStarting $e) => $recorder()->commandStarted($e->command));

        Event::listen(JobProcessing::class, fn (JobProcessing $e) => $this->safely(
            fn () => $recorder()->jobStarted($e->job, $e->connectionName)
        ));

        Event::listen(JobProcessed::class, fn (JobProcessed $e) => $this->safely(
            fn () => $recorder()->jobFinished($e->job, $e->connectionName, $e->job->isReleased() ? 'released' : 'processed')
        ));

        Event::listen(JobReleasedAfterException::class, fn (JobReleasedAfterException $e) => $this->safely(
            fn () => $recorder()->jobFinished($e->job, $e->connectionName, 'released')
        ));

        Event::listen(JobFailed::class, fn (JobFailed $e) => $this->safely(
            fn () => $recorder()->jobFinished($e->job, $e->connectionName, 'failed')
        ));
    }

    /**
     * Monitoring must never break the monitored app.
     */
    protected function safely(callable $callback): void
    {
        try {
            $callback();
        } catch (Throwable) {
            //
        }
    }
}
