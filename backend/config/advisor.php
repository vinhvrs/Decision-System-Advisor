<?php
// config/advisor.php

return [
    'phrases' => require base_path(
        'platform/plugins/advisor/src/Dictionaries/phrases.php'
    ),

    'connectors' => require base_path(
        'platform/plugins/advisor/src/Dictionaries/connectors.php'
    ),

    'error_messages' => require base_path(
        'platform/plugins/advisor/src/Dictionaries/error_messages.php'
    ),

    'glossary' => require base_path(
        'platform/plugins/advisor/src/Dictionaries/glossary.php'
    ),

    'indicator' => require base_path(
        'platform/plugins/advisor/src/Dictionaries/indicator.php'
    ),

    'intent_phrases' => require base_path(
        'platform/plugins/advisor/src/Dictionaries/intent_phrases.php'
    ),

    'strategy' => require base_path(
        'platform/plugins/advisor/src/Dictionaries/strategy.php'
    ),

    'typos' => require base_path(
        'platform/plugins/advisor/src/Dictionaries/typos.php'
    ),
];
