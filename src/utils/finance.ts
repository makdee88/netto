export interface FdAccrualResult {
  currentValue: number;
  accruedInterest: number;
  maturityValue: number;
  totalInterestAtMaturity: number;
  isMatured: boolean;
  daysRemaining: number;
}

export function calculateFdValuation(
  principal: number,
  annualRatePct: number,
  compoundingFreq: number,
  startDateStr: string,
  maturityDateStr?: string
): FdAccrualResult {
  if (!principal || principal <= 0) {
    return {
      currentValue: 0,
      accruedInterest: 0,
      maturityValue: 0,
      totalInterestAtMaturity: 0,
      isMatured: false,
      daysRemaining: 0,
    };
  }

  const now = new Date();
  const start = new Date(startDateStr);
  const maturity = maturityDateStr ? new Date(maturityDateStr) : null;

  const r = annualRatePct / 100;
  const n = compoundingFreq > 0 ? compoundingFreq : 1;

  // 1. Elapsed duration for current valuation
  const effectiveEnd = maturity && now > maturity ? maturity : now;
  const elapsedMs = Math.max(0, effectiveEnd.getTime() - start.getTime());
  const elapsedYears = elapsedMs / (1000 * 60 * 60 * 24 * 365.25);

  // Current accrued compound value
  const currentValue = principal * Math.pow(1 + r / n, n * elapsedYears);
  const accruedInterest = currentValue - principal;

  // 2. Projected maturity calculation
  let maturityValue = currentValue;
  let daysRemaining = 0;
  let isMatured = false;

  if (maturity) {
    const totalMs = Math.max(0, maturity.getTime() - start.getTime());
    const totalYears = totalMs / (1000 * 60 * 60 * 24 * 365.25);
    maturityValue = principal * Math.pow(1 + r / n, n * totalYears);

    const remainingMs = maturity.getTime() - now.getTime();
    daysRemaining = Math.max(0, Math.ceil(remainingMs / (1000 * 60 * 60 * 24)));
    isMatured = now >= maturity;
  }

  return {
    currentValue: Number(currentValue.toFixed(2)),
    accruedInterest: Number(accruedInterest.toFixed(2)),
    maturityValue: Number(maturityValue.toFixed(2)),
    totalInterestAtMaturity: Number((maturityValue - principal).toFixed(2)),
    isMatured,
    daysRemaining,
  };
}