"use client";

import React from "react";
import ValidatedFundamentalRadar from "../../companies/profile/[inc-slug]/FundamentalRadar";

export default function FundamentalRadar({
  symbol,
  compact = false,
}: {
  symbol?: string;
  compact?: boolean;
}) {
  return (
    <ValidatedFundamentalRadar
      symbol={symbol}
      compact={compact}
      showFearGreed
    />
  );
}
