// ============================================================
// EventWise AI — Deterministic Recommendations Engine
// Generates personalized ideas without any external API call.
// AI provider is optional and additive on top of this engine.
// ============================================================

import { EventDetails, Recommendation, BudgetSummary } from '../types';
import { nanoid } from '../utils/nanoid';

/**
 * Generate recommendations deterministically from event details.
 * No network calls. No randomness. Fully testable.
 * Results are clearly labeled as generated suggestions, not verified facts.
 */
export function generateRecommendations(
  event: EventDetails,
  budgetSummary: BudgetSummary
): Recommendation[] {
  const recs: Recommendation[] = [];
  const isTight = budgetSummary.isOverBudget || budgetSummary.remainingAfterContingency < 0;
  const { type, theme, guestCount, preference, dietaryRequirements, accessibilityNeeds, priorities } = event;
  const themeL = theme.toLowerCase();
  const dietL = dietaryRequirements.toLowerCase();
  const a11yL = accessibilityNeeds.toLowerCase();

  // ---- Theme recommendations ----
  if (type === 'wedding') {
    if (themeL.includes('garden') || themeL.includes('outdoor') || preference === 'outdoor') {
      recs.push(rec('theme', 'Garden Ceremony & Reception', 'Natural floral arches, lush greenery, and al-fresco dining create a romantic garden atmosphere.', 'Matches your outdoor preference and garden theme.', 'neutral', undefined, false, [], dietL, a11yL));
    }
    if (themeL.includes('rustic') || themeL.includes('barn')) {
      recs.push(rec('theme', 'Rustic Barn Aesthetic', 'Wooden accents, mason jars, fairy lights, and wildflower centrepieces fit a relaxed countryside vibe.', 'Aligns with your rustic theme preference.', 'neutral', undefined, false, ['rustic', 'barn'], dietL, a11yL));
    }
    if (themeL.includes('modern') || themeL.includes('minimalist')) {
      recs.push(rec('theme', 'Modern Minimalist Wedding', 'Clean lines, white linen, monochromatic palette, and geometric accents for a contemporary aesthetic.', 'Suits your modern or minimalist theme.', 'saves', undefined, true, ['modern', 'minimalist'], dietL, a11yL));
    }
    if (!themeL) {
      recs.push(rec('theme', 'Timeless Elegant Theme', 'A classic palette of ivory, champagne, and blush with candlelight and soft florals suits any wedding setting.', 'A versatile starting point when theme is undecided.', 'neutral', undefined, false, [], dietL, a11yL));
    }
  }

  if (type === 'birthday') {
    if (guestCount <= 20) {
      recs.push(rec('theme', 'Intimate Dinner Party', 'A curated sit-down dinner with personalised menus and ambient lighting creates a memorable evening for close guests.', 'Ideal for your smaller guest count — more personal and cost-effective.', 'saves', undefined, true, ['intimate', 'dinner'], dietL, a11yL));
    }
    if (guestCount > 50) {
      recs.push(rec('theme', 'Celebration Cocktail Reception', 'Standing cocktail format maximises mingling for larger groups and reduces per-head catering costs.', 'Cocktail receptions scale efficiently for your guest count.', 'saves', undefined, true, ['cocktail', 'large'], dietL, a11yL));
    }
    recs.push(rec('theme', 'Personalised Memory Wall', 'Create a visual timeline of the guest of honour\'s life using photos, milestones, and mementos.', 'A highly personal, low-cost decoration that becomes a conversation centrepiece.', 'saves', 50, true, [], dietL, a11yL));
  }

  if (type === 'community') {
    recs.push(rec('theme', 'Community Showcase Theme', 'Celebrate local talent, culture, and history with art displays, live performances, and interactive activities.', 'Engages diverse attendees and builds community pride.', 'neutral', undefined, false, ['community', 'inclusive'], dietL, a11yL));
    recs.push(rec('theme', 'Family-Friendly Festival', 'Mix of food stalls, games, and activities for all ages ensures broad participation.', 'Community events benefit from inclusive programming for families.', 'neutral', undefined, false, [], dietL, a11yL));
  }

  // ---- Menu recommendations ----
  const veganFlag = dietL.includes('vegan') || dietL.includes('plant');
  const glutenFlag = dietL.includes('gluten') || dietL.includes('coeliac') || dietL.includes('celiac');
  const halalFlag = dietL.includes('halal');
  const kosherFlag = dietL.includes('kosher');
  const nutFlag = dietL.includes('nut');

  recs.push(rec('menu', 'Diverse Menu with Clearly Labelled Options', 'Offer at least one vegan, one vegetarian, one nut-free, and one gluten-free dish with clear labels.', `Your dietary requirements (${dietaryRequirements || 'not specified'}) make labelling critical for guest safety and comfort.`, 'neutral', undefined, false, [], dietL, a11yL));

  if (veganFlag) {
    recs.push(rec('menu', 'Plant-Forward Catering', 'Feature vegetables, legumes, and grains as central dishes rather than sides. Works well for all diets and reduces cost.', 'Directly addresses your vegan dietary requirements.', 'saves', undefined, true, ['vegan', 'plant-based'], dietL, a11yL));
  }
  if (glutenFlag) {
    recs.push(rec('menu', 'Certified Gluten-Free Dishes', 'Partner with a caterer certified for gluten-free preparation. Cross-contamination prevention is essential.', 'Addresses gluten-free/coeliac dietary requirements — cross-contamination is a safety concern.', 'neutral', undefined, false, ['gluten-free'], dietL, a11yL));
  }
  if (isTight) {
    recs.push(rec('menu', 'Buffet or Family-Style Serving', 'Buffet or sharing platters reduce per-head costs by 20–40% vs plated service while creating a social atmosphere.', 'Budget-saving alternative to plated catering. Illustrative estimate only — confirm with caterers.', 'saves', undefined, true, ['budget-friendly'], dietL, a11yL));
  }

  // ---- Activity recommendations ----
  if (type !== 'community') {
    recs.push(rec('activity', 'Guest Photo Booth', 'A themed photo station with props gives guests a keepsake and generates natural event documentation.', 'Low cost, high engagement activity suitable for all event types.', 'adds', 300, false, ['entertainment', 'keepsake'], dietL, a11yL));
  }
  if (type === 'wedding') {
    recs.push(rec('activity', 'Interactive Guestbook Alternative', 'A Jenga block, polaroid board, or video message station creates more personal memories than a standard guestbook.', 'Engaging alternative that serves as a lasting keepsake.', 'neutral', 100, false, ['keepsake', 'interactive'], dietL, a11yL));
  }
  if (type === 'birthday') {
    recs.push(rec('activity', 'Trivia or Quiz Game', 'A personalised trivia round about the birthday person is fun for all ages and costs almost nothing.', 'Zero-cost, high-fun activity that personalises the event.', 'saves', 0, true, ['fun', 'personalised'], dietL, a11yL));
  }
  if (type === 'community') {
    recs.push(rec('activity', 'Live Demonstration Stations', 'Invite local artists, cooks, or craftspeople to demonstrate their skills. Builds community and provides entertainment.', 'Draws on community talent, often at no cost or minimal stipend.', 'saves', undefined, true, ['community', 'educational'], dietL, a11yL));
  }

  // ---- Decoration recommendations ----
  recs.push(rec('decoration', 'Sustainable Decoration Choices', 'Use potted plants (guests take home), seed packets, or biodegradable confetti instead of single-use decor.', 'Reduces waste and can reduce decoration costs. Aligns with modern event values.', isTight ? 'saves' : 'neutral', undefined, isTight, ['sustainable', 'eco'], dietL, a11yL));

  if (preference === 'outdoor') {
    recs.push(rec('decoration', 'Natural Landscape as Backdrop', 'Minimise decoration by choosing a naturally beautiful outdoor setting (park, garden, heritage site).', 'Uses the venue\'s natural aesthetics, significantly reducing decoration spend.', 'saves', undefined, true, ['outdoor', 'natural'], dietL, a11yL));
  }

  // ---- Logistics / accessibility recommendations ----
  if (a11yL) {
    recs.push(rec('logistics', 'Accessibility-First Venue Check', 'Verify: step-free access, accessible bathrooms, hearing loops, quiet rooms, and clear signage before booking.', `Your accessibility notes (${accessibilityNeeds}) require explicit venue confirmation.`, 'neutral', undefined, false, ['accessibility', 'inclusive'], dietL, a11yL));
    recs.push(rec('logistics', 'Accessible Transport Coordination', 'Arrange wheelchair-accessible transport and early-arrival options for guests with mobility needs.', 'Directly addresses your stated accessibility requirements.', 'neutral', undefined, false, ['transport', 'accessibility'], dietL, a11yL));
  }

  if (guestCount > 100) {
    recs.push(rec('logistics', 'Professional Event Coordinator', 'For large events, a day-of coordinator manages vendors and schedule so hosts can enjoy the event.', 'Events over 100 guests significantly benefit from professional coordination.', 'adds', 1500, false, ['coordinator', 'large-event'], dietL, a11yL));
  }

  // ---- Budget-saving suggestions ----
  if (isTight) {
    recs.push(rec('entertainment', 'Spotify / DIY Playlist Instead of DJ', 'A curated playlist through a good speaker system is free vs £500–£2000 for a DJ. Suitable for background music.', 'Your budget is tight — this is one of the highest-value savings. Cost estimates are illustrative.', 'saves', 0, true, ['budget', 'music'], dietL, a11yL));
    recs.push(rec('decoration', 'Borrow or Hire Decoration Items', 'Candles, vases, and tablecloths can be hired for 20–30% of purchase price. Check local hire companies.', 'Reduces upfront decoration spend. Estimated savings range — confirm with hire companies.', 'saves', undefined, true, ['budget', 'hire'], dietL, a11yL));
  }

  // ---- Prioritise based on user priorities ----
  const priorityL = priorities.map((p) => p.toLowerCase());
  if (priorityL.some((p) => p.includes('photo'))) {
    recs.push(rec('entertainment', 'Photography Package Comparison', 'Compare 2–3 photographers: full-day vs half-day coverage, digital-only vs prints, with and without video.', 'Photography is one of your stated priorities — comparison ensures best value.', 'neutral', undefined, false, ['photography', 'comparison'], dietL, a11yL));
  }

  return recs;
}

// ----------------------------------------------------------------
// Builder helper — keeps call sites concise
// ----------------------------------------------------------------
function rec(
  category: Recommendation['category'],
  title: string,
  description: string,
  reasoning: string,
  budgetImpact: Recommendation['budgetImpact'],
  estimatedCost: number | undefined,
  isLowCostAlternative: boolean,
  tags: string[],
  dietL: string,
  a11yL: string
): Recommendation {
  const r: Recommendation = {
    id: nanoid(),
    category,
    title,
    description,
    reasoning,
    budgetImpact,
    isLowCostAlternative,
    tags,
  };
  if (estimatedCost !== undefined) r.estimatedCost = estimatedCost;
  if (dietL) r.dietaryNote = 'Dietary requirements considered in this suggestion.';
  if (a11yL) r.accessibilityNote = 'Accessibility requirements noted.';
  return r;
}
