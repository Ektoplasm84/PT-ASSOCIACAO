const RENEWAL_WINDOW_DAYS = 30;

/**
 * Derives fee_status and fee_valid_until from payment data.
 * @param {number} feeAmount  - 0 (exempt) or 300 (standard)
 * @param {string|null} feeLastPaid - ISO date string of last payment, or null
 * @returns {{ status: string, validUntil: string|null }}
 */
function computeFeeStatus(feeAmount, feeLastPaid) {
  feeAmount = parseInt(feeAmount, 10) || 0;

  if (feeAmount === 0) {
    return { status: 'paid', validUntil: null };
  }

  if (!feeLastPaid) {
    return { status: 'unpaid', validUntil: null };
  }

  const paid = new Date(feeLastPaid);
  const validUntil = new Date(paid);
  validUntil.setFullYear(validUntil.getFullYear() + 1);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const renewalStart = new Date(validUntil);
  renewalStart.setDate(renewalStart.getDate() - RENEWAL_WINDOW_DAYS);

  const validUntilStr = validUntil.toISOString().slice(0, 10);

  if (today > validUntil) {
    return { status: 'unpaid', validUntil: validUntilStr };
  }
  if (today >= renewalStart) {
    return { status: 'renewal_incoming', validUntil: validUntilStr };
  }
  return { status: 'paid', validUntil: validUntilStr };
}

module.exports = { computeFeeStatus };
