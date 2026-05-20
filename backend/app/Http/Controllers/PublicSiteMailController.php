<?php

namespace App\Http\Controllers;

use App\Models\SiteMailSetting;
use Illuminate\Http\Request;

class PublicSiteMailController extends Controller
{
    /**
     * Public-safe subset for the marketing contact page (no secrets).
     */
    public function contactDisplay(Request $request)
    {
        $row = SiteMailSetting::singleton();

        return response()->json([
            'data' => [
                'support_public_email' => $row?->support_public_email
                    ?? SiteMailSetting::effectiveSupportPublicEmail(),
            ],
        ]);
    }
}
