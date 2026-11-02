<?php

use App\Http\Controllers\ExceptionController;
use App\Http\Controllers\HostController;
use App\Http\Controllers\JobController;
use App\Http\Controllers\LogController;
use App\Http\Controllers\ProjectController;
use App\Http\Controllers\RequestController;
use App\Http\Controllers\SecurityController;
use Illuminate\Support\Facades\Route;

Route::redirect('/', '/projects')->name('home');

Route::middleware(['auth'])->group(function () {
    Route::redirect('dashboard', '/projects')->name('dashboard');

    Route::get('projects', [ProjectController::class, 'index'])->name('projects.index');
    Route::post('projects', [ProjectController::class, 'store'])->name('projects.store');
    Route::get('hosts', [HostController::class, 'index'])->name('hosts.index');
    Route::get('security', [SecurityController::class, 'index'])->name('security.index');
    Route::post('security/scan', [SecurityController::class, 'scan'])->name('security.scan');

    Route::prefix('projects/{project}')->group(function () {
        Route::get('/', [ProjectController::class, 'show'])->name('projects.show');
        Route::get('setup', [ProjectController::class, 'setup'])->name('projects.setup');
        Route::patch('/', [ProjectController::class, 'update'])->name('projects.update');
        Route::post('token', [ProjectController::class, 'regenerateToken'])->name('projects.token');
        Route::delete('/', [ProjectController::class, 'destroy'])->name('projects.destroy');

        Route::get('requests', [RequestController::class, 'index'])->name('requests.index');
        Route::get('jobs', [JobController::class, 'index'])->name('jobs.index');
        Route::get('logs', [LogController::class, 'index'])->name('logs.index');

        Route::get('exceptions', [ExceptionController::class, 'index'])->name('exceptions.index');
        Route::get('exceptions/{exception}', [ExceptionController::class, 'show'])->name('exceptions.show');
        Route::patch('exceptions/{exception}', [ExceptionController::class, 'update'])->name('exceptions.update');
    });
});

require __DIR__.'/settings.php';
require __DIR__.'/auth.php';
