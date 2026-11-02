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
        // Known vulnerabilities and support status per component version, refreshed by signal:scan-vulnerabilities...
        Schema::create('version_checks', function (Blueprint $table) {
            $table->id();
            $table->string('component', 32);
            $table->string('version', 64);
            $table->json('advisories')->nullable();
            $table->string('latest_patch', 64)->nullable();
            $table->string('latest_release', 64)->nullable();
            $table->boolean('eol')->nullable();
            $table->date('eol_date')->nullable();
            $table->text('error')->nullable();
            $table->dateTime('checked_at')->nullable();
            $table->timestamps();

            $table->unique(['component', 'version']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('version_checks');
    }
};
