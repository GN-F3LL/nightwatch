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
        Schema::create('log_entries', function (Blueprint $table) {
            $table->id();
            $table->foreignId('project_id')->constrained()->cascadeOnDelete();
            $table->foreignId('host_id')->nullable()->constrained()->nullOnDelete();
            $table->string('level', 16);
            $table->text('message');
            $table->json('context')->nullable();
            $table->dateTime('logged_at');

            $table->index(['project_id', 'logged_at']);
            $table->index(['project_id', 'level', 'logged_at']);
        });

        Schema::create('request_records', function (Blueprint $table) {
            $table->id();
            $table->foreignId('project_id')->constrained()->cascadeOnDelete();
            $table->foreignId('host_id')->nullable()->constrained()->nullOnDelete();
            $table->string('method', 10);
            $table->string('route');
            $table->unsignedSmallInteger('status');
            $table->unsignedInteger('duration_ms');
            $table->dateTime('recorded_at');

            $table->index(['project_id', 'recorded_at']);
            $table->index(['project_id', 'route', 'method']);
        });

        Schema::create('job_records', function (Blueprint $table) {
            $table->id();
            $table->foreignId('project_id')->constrained()->cascadeOnDelete();
            $table->foreignId('host_id')->nullable()->constrained()->nullOnDelete();
            $table->string('name');
            $table->string('connection')->nullable();
            $table->string('queue')->nullable();
            $table->string('status', 16);
            $table->unsignedInteger('duration_ms');
            $table->dateTime('recorded_at');

            $table->index(['project_id', 'recorded_at']);
            $table->index(['project_id', 'name']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('job_records');
        Schema::dropIfExists('request_records');
        Schema::dropIfExists('log_entries');
    }
};
