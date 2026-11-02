<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('hosts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('project_id')->constrained()->cascadeOnDelete();
            $table->string('hostname');

            // Stack versions, refreshed by every report...
            $table->string('os_name')->nullable();
            $table->string('os_version')->nullable();
            $table->string('kernel')->nullable();
            $table->string('php_version', 32)->nullable();
            $table->string('laravel_version', 32)->nullable();
            $table->string('composer_version', 32)->nullable();
            $table->string('node_version', 32)->nullable();
            $table->string('database_version')->nullable();

            // Latest resource snapshot, so overview pages never scan history...
            $table->unsignedSmallInteger('cpu_cores')->nullable();
            $table->decimal('cpu_percent', 5, 2)->nullable();
            $table->unsignedBigInteger('memory_used')->nullable();
            $table->unsignedBigInteger('memory_total')->nullable();
            $table->unsignedBigInteger('disk_used')->nullable();
            $table->unsignedBigInteger('disk_total')->nullable();
            $table->decimal('load_1', 8, 2)->nullable();
            $table->decimal('load_5', 8, 2)->nullable();
            $table->decimal('load_15', 8, 2)->nullable();
            $table->unsignedBigInteger('uptime_seconds')->nullable();

            $table->dateTime('last_seen_at')->nullable();
            $table->timestamps();

            $table->unique(['project_id', 'hostname']);
        });

        Schema::create('host_metrics', function (Blueprint $table) {
            $table->id();
            $table->foreignId('host_id')->constrained()->cascadeOnDelete();
            $table->decimal('cpu_percent', 5, 2)->nullable();
            $table->unsignedBigInteger('memory_used')->nullable();
            $table->unsignedBigInteger('memory_total')->nullable();
            $table->unsignedBigInteger('disk_used')->nullable();
            $table->unsignedBigInteger('disk_total')->nullable();
            $table->decimal('load_1', 8, 2)->nullable();
            $table->dateTime('recorded_at');

            $table->index(['host_id', 'recorded_at']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('host_metrics');
        Schema::dropIfExists('hosts');
    }
};
