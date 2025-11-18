<?php

use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return view('welcome');
});
Route::get('/{any}', function () {
    return view('app'); // hoặc view('index') nếu bạn dùng view đó
})->where('any', '.*');