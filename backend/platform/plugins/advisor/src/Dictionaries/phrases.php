<?php

return [
  'openers' => [
    'spoken_casual' => [
      "Sure — here’s what I found.",
      "Got it. Here’s the quick rundown.",
      "Okay, let’s break it down.",
    ],
    'spoken_professional' => [
      "Certainly. Here’s a concise summary.",
      "Understood. Here are the key points.",
      "Here’s what I can share based on the available information.",
    ],
    'written_standard' => [
      "Below is a summary of the relevant information.",
      "The following points address your request.",
    ],
    'written_formal' => [
      "This response summarizes the available information relevant to your request.",
      "The analysis below is based on the data currently available.",
    ],
  ],

  'transitions' => [
    "In short,",
    "That said,",
    "More importantly,",
    "From a practical standpoint,",
  ],

  'hedges' => [
    'spoken' => [
      "I might be missing some context, but",
      "Based on what we have so far,",
      "From the latest available data,",
    ],
    'written' => [
      "Based on the available evidence,",
      "It is important to note that",
      "The data suggests that",
    ],
  ],

  'follow_up_questions' => [
    'news_search' => [
      "Do you want reputable sources only (e.g., Reuters, Bloomberg)?",
      "Which timeframe should I use: today, last 7 days, or last 30 days?",
      "Do you want a quick summary or the full article text?",
    ],
    'price_check' => [
      "Do you want real-time price or the close price for a specific date?",
      "Should I include a quick trend summary (1D/1W/1M)?",
    ],
    'compare' => [
      "Which criteria should I compare: valuation, growth, risk, or recent news?",
    ],
    'default' => [
      "Do you want a brief answer or a more detailed explanation?",
    ],
  ],

  'closers' => [
    'spoken_casual' => [
      "Want me to dig deeper?",
      "If you want, I can narrow it down further.",
    ],
    'spoken_professional' => [
      "If you’d like, I can refine this further based on your preferred timeframe or sources.",
      "Let me know if you want a deeper breakdown.",
    ],
    'written_standard' => [
      "Please let me know if you would like additional details.",
    ],
    'written_formal' => [
      "Should you require further clarification, please specify your preferred constraints (timeframe, sources, and output format).",
    ],
  ],
];
