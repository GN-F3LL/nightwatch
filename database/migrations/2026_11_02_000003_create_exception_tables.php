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
        Schema::create('exception_groups', function (Blueprint $table) {
            $table->id();
            $table->foreignId('project_id')->constrained()->cascadeOnDelete();
            $table->char('fingerprint', 40);
            $table->string('class');
            $table->text('message');
            $table->string('file')->nullable();
            $table->unsignedInteger('line')->nullable();
            $table->unsignedInteger('occurrence_count')->default(0);
            $table->string('status', 16)->default('unresolved');
            $table->dateTime('first_seen_at');
            $table->dateTime('last_seen_at');
            $table->dateTime('resolved_at')->nullable();
            $table->dateTime('regressed_at')->nullable();
            $table->timestamps();

            $table->unique(['project_id', 'fingerprint']);
            $table->index(['project_id', 'status', 'last_seen_at']);
        });

        Schema::create('exception_occurrences', function (Blueprint $table) {
            $table->id();
            $table->foreignId('exception_group_id')->constrained()->cascadeOnDelete();
            $table->foreignId('project_id')->constrained()->cascadeOnDelete();
            $table->foreignId('host_id')->nullable()->constrained()->nullOnDelete();
            $table->text('message');
            $table->boolean('handled')->default(false);
            $table->json('trace')->nullable();
            $table->json('code')->nullable();
            $table->json('context')->nullable();
            $table->string('php_version', 32)->nullable();
            $table->string('laravel_version', 32)->nullable();
            $table->dateTime('occurred_at');

            $table->index(['project_id', 'occurred_at']);
            $table->index(['exception_group_id', 'occurred_at']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('exception_occurrences');
        Schema::dropIfExists('exception_groups');
    }
};
