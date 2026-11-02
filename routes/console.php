<?php

use Illuminate\Support\Facades\Schedule;

Schedule::command('signal:prune')->daily();

// New versions are checked within the hour; known ones are refreshed once their check is a day old...
Schedule::command('signal:scan-vulnerabilities')->hourly()->withoutOverlapping()->runInBackground();
