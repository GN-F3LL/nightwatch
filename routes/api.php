<?php

use App\Http\Controllers\Api\IngestController;
use App\Http\Middleware\AuthenticateProject;
use Illuminate\Support\Facades\Route;

Route::post('ingest', IngestController::class)
    ->middleware([AuthenticateProject::class, 'throttle:ingest'])
    ->name('ingest');
