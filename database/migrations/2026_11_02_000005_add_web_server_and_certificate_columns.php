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
        Schema::table('hosts', function (Blueprint $table) {
            // As reported, e.g. "nginx/1.27.0" or "Apache/2.4.58 (Ubuntu)"...
            $table->string('web_server', 120)->nullable()->after('database_version');
        });

        // The TLS certificate served at the app's URL, as last seen by an agent...
        Schema::table('projects', function (Blueprint $table) {
            $table->string('certificate_host')->nullable()->after('token_hash');
            $table->string('certificate_issuer')->nullable()->after('certificate_host');
            $table->dateTime('certificate_expires_at')->nullable()->after('certificate_issuer');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('projects', function (Blueprint $table) {
            $table->dropColumn(['certificate_host', 'certificate_issuer', 'certificate_expires_at']);
        });

        Schema::table('hosts', function (Blueprint $table) {
            $table->dropColumn('web_server');
        });
    }
};
