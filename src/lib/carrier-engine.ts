import Decimal from 'decimal.js';
import { RATE_CARD, BALANCED_WEIGHTS, SELLER_PRIORITIES } from './constants';
import type { Booking, CarrierCandidate, Recommendation } from './schemas';

export function getCarrierCandidates(booking: Booking): CarrierCandidate[] {
  const routeServices = RATE_CARD.filter(
    s => s.destinationCountry === booking.destinationCountry
  );

  const pallets = booking.pallets ?? 0;
  const grossWeight = booking.totalGrossWeight ?? 0;
  const wpp = pallets > 0 ? new Decimal(grossWeight).div(new Decimal(pallets)) : null;

  return routeServices.map(s => {
    const wppNum = wpp ? wpp.toDecimalPlaces(2).toNumber() : 0;
    const eligible = wpp !== null && wpp.lte(new Decimal(s.maxKgPerPallet));
    const totalCost = s.pricePerPallet * pallets;

    return {
      carrier: s.carrier,
      service: s.service,
      destinationCountry: s.destinationCountry,
      pricePerPallet: s.pricePerPallet,
      totalCost,
      costPerPallet: s.pricePerPallet,
      transitDays: s.transitDays,
      onTimePercent: s.onTimePercent,
      maxKgPerPallet: s.maxKgPerPallet,
      actualKgPerPallet: wppNum,
      eligible,
      ineligibleReason: eligible
        ? undefined
        : `${wppNum} kg/pallet exceeds ${s.maxKgPerPallet} kg limit`,
    };
  });
}

function minMaxNormalise(values: number[], lowerIsBetter: boolean): number[] {
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (min === max) return values.map(() => 0);
  return values.map(v => {
    // 0 = best, 1 = worst, so every dimension can be summed the same way.
    const norm = (v - min) / (max - min);
    return lowerIsBetter ? norm : 1 - norm;
  });
}

export function rankCandidates(
  candidates: CarrierCandidate[],
  priority: string
): CarrierCandidate[] {
  const eligible = candidates.filter(c => c.eligible);
  if (eligible.length === 0) return [];

  switch (priority) {
    case 'Cheapest':
      return [...eligible].sort((a, b) => {
        if (a.totalCost !== b.totalCost) return a.totalCost - b.totalCost;
        if (a.onTimePercent !== b.onTimePercent) return b.onTimePercent - a.onTimePercent;
        return a.transitDays - b.transitDays;
      });

    case 'Fastest':
      return [...eligible].sort((a, b) => {
        if (a.transitDays !== b.transitDays) return a.transitDays - b.transitDays;
        return a.totalCost - b.totalCost;
      });

    case 'Most reliable':
      return [...eligible].sort((a, b) => {
        if (a.onTimePercent !== b.onTimePercent) return b.onTimePercent - a.onTimePercent;
        return a.totalCost - b.totalCost;
      });

    case 'Balanced':
    default: {
      const costs = eligible.map(c => c.totalCost);
      const transits = eligible.map(c => c.transitDays);
      const reliabilities = eligible.map(c => c.onTimePercent);

      const costN = minMaxNormalise(costs, true);
      const transitN = minMaxNormalise(transits, true);
      const relN = minMaxNormalise(reliabilities, false);

      const scored = eligible.map((c, i) => ({
        ...c,
        score: BALANCED_WEIGHTS.cost * costN[i] +
          BALANCED_WEIGHTS.transit * transitN[i] +
          BALANCED_WEIGHTS.reliability * relN[i],
      }));

      return scored.sort((a, b) => {
        if (a.score !== b.score) return a.score! - b.score!;
        if (a.onTimePercent !== b.onTimePercent) return b.onTimePercent - a.onTimePercent;
        return a.totalCost - b.totalCost;
      });
    }
  }
}

export function getRecommendation(booking: Booking): Recommendation {
  const priority = (SELLER_PRIORITIES as readonly string[]).includes(booking.sellerPriority) ? booking.sellerPriority : 'Balanced';
  const allCandidates = getCarrierCandidates(booking);
  const ranked = rankCandidates(allCandidates, priority);

  if (allCandidates.length === 0) {
    return {
      recommended: null,
      allCandidates,
      bestAlternative: null,
      explanation: booking.destinationCountry
        ? `No rate card covers ${booking.destinationCountry}. Supported destinations are Germany, France and the Netherlands.`
        : 'Tell me the destination country and I will rank the carriers for that route.',
      priority,
      noEligibleReason: booking.destinationCountry
        ? `No services run to ${booking.destinationCountry}.`
        : 'Destination country missing.',
    };
  }

  if (ranked.length === 0) {
    const wpp = booking.pallets && booking.pallets > 0 && booking.totalGrossWeight
      ? new Decimal(booking.totalGrossWeight).div(new Decimal(booking.pallets)).toDecimalPlaces(2).toNumber()
      : null;

    const maxAvailable = allCandidates.length > 0 ? Math.max(...allCandidates.map(c => c.maxKgPerPallet)) : 0;

    return {
      recommended: null,
      allCandidates,
      bestAlternative: null,
      explanation: wpp !== null
        ? `No eligible service for this route. Weight per pallet is ${wpp} kg, but the maximum capacity available is ${maxAvailable} kg. Add more pallets to bring weight per pallet below ${maxAvailable} kg.`
        : 'Cannot determine eligibility — pallets or weight information is missing.',
      priority,
      noEligibleReason: wpp !== null
        ? `Weight per pallet (${wpp} kg) exceeds all available carriers' limits (max ${maxAvailable} kg).`
        : 'Missing pallets or weight data.',
    };
  }

  const recommended = ranked[0];
  const bestAlternative = ranked.length > 1 ? ranked[1] : null;

  let explanation = '';
  switch (priority) {
    case 'Cheapest':
      explanation = `Chosen because you said Cheapest. £${recommended.totalCost} total (£${recommended.pricePerPallet}/pallet) is the lowest cost option${recommended.actualKgPerPallet > 0 ? ` and well within the ${recommended.maxKgPerPallet} kg limit at ${recommended.actualKgPerPallet} kg/pallet` : ''}.`;
      break;
    case 'Fastest':
      explanation = `Chosen because you said Fastest. ${recommended.transitDays} day${recommended.transitDays > 1 ? 's' : ''} transit is the quickest available${recommended.actualKgPerPallet > 0 ? ` and within the ${recommended.maxKgPerPallet} kg limit at ${recommended.actualKgPerPallet} kg/pallet` : ''}.`;
      break;
    case 'Most reliable':
      explanation = `Chosen because you said Most reliable. ${recommended.onTimePercent}% on-time rate is the highest available${recommended.actualKgPerPallet > 0 ? ` and within the ${recommended.maxKgPerPallet} kg limit at ${recommended.actualKgPerPallet} kg/pallet` : ''}.`;
      break;
    case 'Balanced':
      explanation = `Chosen using Balanced scoring (40% cost, 30% transit, 30% reliability). ${recommended.carrier} ${recommended.service} scored ${recommended.score?.toFixed(3)}, the best trade-off across all three (lower is better).`;
      break;
    default:
      explanation = `No priority was given, so Balanced scoring was used. ${recommended.carrier} ${recommended.service} is the best trade-off across cost, transit and reliability.`;
  }

  let alternativeTradeoff: string | undefined;
  if (bestAlternative) {
    const costDiff = bestAlternative.totalCost - recommended.totalCost;
    const transitDiff = recommended.transitDays - bestAlternative.transitDays;
    const parts: string[] = [];
    if (transitDiff > 0) parts.push(`arrives ${transitDiff} day${transitDiff > 1 ? 's' : ''} sooner`);
    if (transitDiff < 0) parts.push(`takes ${-transitDiff} more day${-transitDiff > 1 ? 's' : ''}`);
    if (costDiff > 0) parts.push(`for £${costDiff} more`);
    if (costDiff < 0) parts.push(`saving £${-costDiff}`);
    if (bestAlternative.onTimePercent !== recommended.onTimePercent) {
      parts.push(`${bestAlternative.onTimePercent}% on-time vs ${recommended.onTimePercent}%`);
    }
    alternativeTradeoff = `${bestAlternative.carrier} ${bestAlternative.service}: ${parts.join(', ')}.`;
  }

  return {
    recommended,
    allCandidates,
    bestAlternative,
    explanation,
    alternativeTradeoff,
    priority,
  };
}
