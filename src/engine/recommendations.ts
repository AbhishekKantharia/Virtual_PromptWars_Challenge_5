// ============================================================
// EventWise AI — Deterministic Recommendations Engine
// Generates personalized ideas without any external API call.
// AI provider is optional and additive on top of this engine.
// ============================================================

import { EventDetails, Recommendation, BudgetSummary } from '../types';
import { nanoid } from '../utils/nanoid';

/** Explain which details were missing so the UI can label assumptions. */
export function deriveAssumptions(event: EventDetails): string[] {
  const assumptions: string[] = [];
  if (!event.theme.trim()) {
    assumptions.push('No theme was provided, so style ideas use a versatile, neutral direction.');
  }
  if (!event.city.trim()) {
    assumptions.push('No city or venue was provided, so location ideas use general local-supplier guidance.');
  }
  if (!event.dietaryRequirements.trim()) {
    assumptions.push('No dietary requirements were listed; menu ideas default to clearly labelled, varied options.');
  }
  if (!event.accessibilityNeeds.trim()) {
    assumptions.push('No accessibility needs were listed; venue checks use baseline inclusive-access guidance.');
  }
  return assumptions;
}

/**
 * Generate recommendations deterministically from event details.
 * No network calls. No randomness beyond unique IDs. Fully testable.
 * Results are clearly labeled as generated suggestions, not verified facts.
 */
export function generateRecommendations(
  event: EventDetails,
  budgetSummary: BudgetSummary
): Recommendation[] {
  const recs: Recommendation[] = [];
  const isTight =
    budgetSummary.isOverBudget ||
    budgetSummary.isOverContingency ||
    budgetSummary.remainingAfterContingency < 0;
  const hasComfortableBuffer =
    !isTight && budgetSummary.totalBudget > 0 &&
    budgetSummary.remainingAfterContingency > budgetSummary.totalBudget * 0.2;

  const { type, theme, guestCount, preference, dietaryRequirements, accessibilityNeeds, priorities, city } = event;
  const themeL = theme.toLowerCase();
  const dietL = dietaryRequirements.toLowerCase();
  const a11yL = accessibilityNeeds.toLowerCase();
  const priorityL = priorities.map((p) => p.toLowerCase());
  const hasPriority = (keyword: string) => priorityL.some((p) => p.includes(keyword));

  // ---- Theme recommendations ----
  if (type === 'wedding') {
    if (themeL.includes('garden') || themeL.includes('outdoor') || preference === 'outdoor') {
      recs.push(
        rec('theme', 'Garden Ceremony & Reception', 'Natural floral arches, greenery, and al-fresco dining create a soft garden atmosphere.', 'Matches your outdoor preference and garden direction.', 'neutral', undefined, false, ['garden', 'outdoor'], dietL, a11yL)
      );
    }
    if (themeL.includes('rustic') || themeL.includes('barn')) {
      recs.push(
        rec('theme', 'Rustic Barn Aesthetic', 'Wooden accents, warm lighting, and wildflower centrepieces fit a relaxed countryside vibe.', 'Aligns with your rustic theme preference.', 'neutral', undefined, false, ['rustic', 'barn'], dietL, a11yL)
      );
    }
    if (themeL.includes('modern') || themeL.includes('minimalist')) {
      recs.push(
        rec('theme', 'Modern Minimalist Wedding', 'Clean lines, restrained colour, and geometric accents for a contemporary aesthetic.', 'Suits your modern or minimalist theme.', 'saves', undefined, true, ['modern', 'minimalist'], dietL, a11yL)
      );
    }
    if (!themeL) {
      recs.push(
        rec('theme', 'Timeless Elegant Theme', 'A classic palette of ivory, champagne, and blush with candlelight and soft florals suits many settings.', 'A versatile starting point when the theme is undecided.', 'neutral', undefined, false, ['classic', 'versatile'], dietL, a11yL)
      );
    }
  }

  if (type === 'birthday') {
    if (guestCount <= 20) {
      recs.push(
        rec('theme', 'Intimate Dinner Party', 'A curated sit-down dinner with personalised menus and ambient lighting creates a memorable evening for close guests.', 'Ideal for your smaller guest count — more personal and easier to control costs.', 'saves', undefined, true, ['intimate', 'dinner'], dietL, a11yL)
      );
    }
    if (guestCount > 50) {
      recs.push(
        rec('theme', 'Celebration Cocktail Reception', 'A standing cocktail format encourages mingling for larger groups and can reduce per-head service costs.', 'Cocktail receptions scale efficiently for your guest count. Confirm catering and seating needs locally.', 'saves', undefined, true, ['cocktail', 'large'], dietL, a11yL)
      );
    }
    recs.push(
      rec('theme', 'Personalized Memory Wall', 'Create a visual timeline of the guest of honour using photos, milestones, and mementos.', 'A highly personal, low-cost decoration that becomes a conversation centrepiece.', 'saves', undefined, true, ['personal', 'keepsake'], dietL, a11yL)
    );
    if (themeL) {
      recs.push(
        rec('theme', `Build Around Your "${theme.trim()}" Theme`, 'Use one strong visual motif in invitations, table settings, and one focal backdrop rather than repeating it everywhere.', 'Keeps your chosen theme coherent without overspending on props.', 'neutral', undefined, false, ['theme', 'cohesive'], dietL, a11yL)
      );
    }
  }

  if (type === 'community') {
    recs.push(
      rec('theme', 'Community Showcase', 'Celebrate local talent, culture, and history with displays, performances, and interactive activities.', 'Engages diverse attendees and builds community pride. Invite participants rather than speaking for them.', 'neutral', undefined, false, ['community', 'inclusive'], dietL, a11yL)
    );
    recs.push(
      rec('theme', 'Family-Friendly Festival', 'Mix food stalls, games, and activities for multiple ages to support broad participation.', 'Community events benefit from inclusive programming for families and caregivers.', 'neutral', undefined, false, ['family', 'inclusive'], dietL, a11yL)
    );
    if (themeL) {
      recs.push(
        rec('theme', `Celebrate the "${theme.trim()}" Theme`, 'Co-design the programme with community members so the theme reflects their traditions rather than a generic interpretation.', 'Your theme is community-led, which reduces stereotyping and increases relevance.', 'neutral', undefined, false, ['co-design', 'theme'], dietL, a11yL)
      );
    }
  }

  // ---- Location-aware, non-fabricated guidance ----
  if (city.trim()) {
    recs.push(
      rec('logistics', `Local Supplier Shortlist for ${city.trim()}`, 'Ask the venue for a preferred-supplier list, then compare at least three local options for your highest-spend categories.', `Your event is in ${city.trim()}; local comparison reduces travel fees and delivery risk. EventWise does not verify suppliers or prices.`, 'neutral', undefined, false, ['local', 'vendors'], dietL, a11yL)
    );
  }
  if (preference === 'outdoor' || themeL.includes('garden')) {
    recs.push(
      rec('logistics', 'Weather Contingency Plan', 'Agree on a covered backup space, wind plan, and a decision deadline with the venue and rental suppliers.', 'Your outdoor or garden preference makes weather planning essential. This is process guidance, not a forecast.', 'adds', Math.round(budgetSummary.totalBudget * 0.03 * 100) / 100, false, ['weather', 'contingency'], dietL, a11yL)
    );
  }

  // ---- Menu recommendations ----
  const veganFlag = dietL.includes('vegan') || dietL.includes('plant');
  const glutenFlag = dietL.includes('gluten') || dietL.includes('coeliac') || dietL.includes('celiac');
  const halalFlag = dietL.includes('halal');
  const kosherFlag = dietL.includes('kosher');
  const nutFlag = dietL.includes('nut');

  recs.push(
    rec('menu', 'Diverse Menu with Clearly Labelled Options', 'Offer at least one vegan, one vegetarian, one nut-free, and one gluten-free dish with clear ingredient labels.', `Your dietary notes (${dietaryRequirements || 'none provided'}) make transparent labelling important for guest safety and comfort.`, 'neutral', undefined, false, ['dietary', 'labels'], dietL, a11yL)
  );

  if (veganFlag) {
    recs.push(
      rec('menu', 'Plant-Forward Catering', 'Feature vegetables, legumes, and grains as central dishes rather than sides; confirm allergens with the caterer.', 'Directly addresses your plant-based requirement and can reduce cost when planned in season.', 'saves', undefined, true, ['vegan', 'plant-based'], dietL, a11yL)
    );
  }
  if (glutenFlag) {
    recs.push(
      rec('menu', 'Certified Gluten-Free Preparation', 'Ask the caterer to document gluten-free preparation and cross-contamination controls.', 'Addresses gluten-free/coeliac requirements. Cross-contamination is a safety concern, so verify with the caterer.', 'neutral', undefined, false, ['gluten-free', 'safety'], dietL, a11yL)
    );
  }
  if (halalFlag) {
    recs.push(
      rec('menu', 'Halal Option with Clear Sourcing', 'Request a halal main course and ask the caterer to confirm sourcing and preparation separately from other dishes.', 'Reflects your stated halal requirement without assuming the whole menu must change.', 'neutral', undefined, false, ['halal', 'inclusive'], dietL, a11yL)
    );
  }
  if (kosherFlag) {
    recs.push(
      rec('menu', 'Kosher Option with Documented Preparation', 'Ask the caterer about kosher options, separate preparation, and acceptable certification for your guests.', 'Reflects your stated kosher requirement. Ask guests about their level of observance rather than assuming one standard.', 'neutral', undefined, false, ['kosher', 'inclusive'], dietL, a11yL)
    );
  }
  if (nutFlag) {
    recs.push(
      rec('menu', 'Nut-Allergy Safety Briefing', 'Share a written allergy brief with the caterer and service lead, and label all dishes at the buffet.', 'Directly addresses your nut-allergy note. Confirm emergency procedures with the venue.', 'neutral', undefined, false, ['allergy', 'safety'], dietL, a11yL)
    );
  }
  if (isTight) {
    recs.push(
      rec('menu', 'Buffet or Family-Style Serving', 'Buffet or sharing platters can reduce per-head service costs versus plated service while creating a social atmosphere.', 'Budget-saving alternative to plated catering. Savings vary by caterer — this is illustrative, not a quote.', 'saves', undefined, true, ['budget-friendly', 'service'], dietL, a11yL)
    );
  }

  // ---- Activity recommendations ----
  if (type !== 'community') {
    recs.push(
      rec('activity', 'Guest Photo Station', 'A themed photo station with props gives guests a keepsake and creates natural event documentation.', 'Low-to-moderate cost, high engagement activity suitable for many event types.', 'adds', Math.round(budgetSummary.totalBudget * 0.03 * 100) / 100, false, ['entertainment', 'keepsake'], dietL, a11yL)
    );
  }
  if (type === 'wedding') {
    recs.push(
      rec('activity', 'Interactive Guestbook Alternative', 'A Jenga block, polaroid board, or video message station creates a personal keepsake.', 'Engaging alternative that does not require a large budget.', 'neutral', Math.round(budgetSummary.totalBudget * 0.01 * 100) / 100, false, ['keepsake', 'interactive'], dietL, a11yL)
    );
  }
  if (type === 'birthday') {
    recs.push(
      rec('activity', 'Personalized Trivia Round', 'A trivia game about the birthday person is fun for multiple ages and needs only prepared questions.', 'Low-cost activity that personalises the event.', 'saves', undefined, true, ['fun', 'personalised'], dietL, a11yL)
    );
  }
  if (type === 'community') {
    recs.push(
      rec('activity', 'Live Demonstration Stations', 'Invite local artists, cooks, or craftspeople to demonstrate their skills.', 'Draws on community talent; compensation and availability must be agreed directly with participants.', 'neutral', undefined, false, ['community', 'educational'], dietL, a11yL)
    );
  }

  // ---- Decoration recommendations ----
  recs.push(
    rec('decoration', 'Reusable or Sustainable Decoration', 'Use potted plants that guests can take home, fabric drapes, or biodegradable confetti instead of single-use decor.', 'Can reduce waste and sometimes cost. Aligns with practical, lower-waste planning.', isTight ? 'saves' : 'neutral', undefined, isTight, ['sustainable', 'eco'], dietL, a11yL)
  );

  if (preference === 'outdoor') {
    recs.push(
      rec('decoration', 'Let the Landscape Lead', 'Minimise decoration by choosing a naturally attractive outdoor setting and concentrating spend on lighting and comfort.', 'Uses the venue\'s existing aesthetics, often reducing decoration spend.', 'saves', undefined, true, ['outdoor', 'natural'], dietL, a11yL)
    );
  }

  // ---- Accessibility recommendations ----
  if (a11yL || hasPriority('accessibility')) {
    recs.push(
      rec('logistics', 'Accessibility-First Venue Check', 'Verify step-free access, accessible bathrooms, hearing loops, quiet rooms, and clear signage before booking.', `Your accessibility notes (${accessibilityNeeds || 'general accessibility priority'}) require explicit venue confirmation.`, 'neutral', undefined, false, ['accessibility', 'venue'], dietL, a11yL)
    );
    recs.push(
      rec('logistics', 'Accessible Transport and Arrival Window', 'Arrange accessible transport and a flexible arrival window for guests with mobility or sensory needs.', 'Directly supports guests who may need extra time or assistance.', 'neutral', undefined, false, ['transport', 'accessibility'], dietL, a11yL)
    );
  }

  // ---- Priority-specific recommendations ----
  if (hasPriority('photo')) {
    recs.push(
      rec('entertainment', 'Photography Package Comparison', 'Compare two or three photographers on coverage hours, deliverables, and accessibility of the shooting locations.', 'Photography is one of your stated priorities — structured comparison helps avoid paying for unused deliverables.', 'neutral', undefined, false, ['photography', 'comparison'], dietL, a11yL)
    );
  }
  if (hasPriority('guest comfort')) {
    recs.push(
      rec('logistics', 'Comfort and Quiet Zone', 'Plan enough seating, shade or heating, water stations, and a quieter space for guests who need a break.', 'Guest comfort is one of your stated priorities and improves the experience across ages and needs.', 'neutral', undefined, false, ['comfort', 'inclusive'], dietL, a11yL)
    );
  }
  if (hasPriority('unique')) {
    recs.push(
      rec('activity', 'One Signature Moment', 'Choose one memorable moment — a story-sharing session, a live performance, or a surprise reveal — instead of many small extras.', 'A single well-executed signature moment often feels more distinctive than scattered add-ons.', 'neutral', Math.round(budgetSummary.totalBudget * 0.05 * 100) / 100, false, ['unique', 'experience'], dietL, a11yL)
    );
  }
  if (hasPriority('budget')) {
    recs.push(
      rec('logistics', 'Spend Prioritization Workshop', 'Rank venue, food, and one guest-experience element first; cap everything else until those three are quoted.', 'Budget savings is a stated priority. This sequence prevents small purchases from crowding out essentials.', 'saves', undefined, true, ['budget', 'prioritisation'], dietL, a11yL)
    );
  }

  if (guestCount > 100) {
    recs.push(
      rec('logistics', 'Day-of Coordination Support', 'For larger events, a day-of coordinator can manage vendor timing and guest flow so hosts can be present.', 'Events over 100 guests often benefit from dedicated coordination. Fees vary by location.', 'adds', Math.round(budgetSummary.totalBudget * 0.1 * 100) / 100, false, ['coordinator', 'large-event'], dietL, a11yL)
    );
  }

  // ---- Budget-saving suggestions ----
  if (isTight) {
    recs.push(
      rec('entertainment', 'Curated Playlist Instead of Live Music', 'A well-prepared playlist and reliable speaker system can cover background and dance music without a band.', 'Your budget is under pressure — music is often a high-value place to simplify. This is a suggestion, not a guaranteed saving.', 'saves', undefined, true, ['budget', 'music'], dietL, a11yL)
    );
    recs.push(
      rec('decoration', 'Borrow or Hire Decoration Items', 'Candles, vases, and tablecloths can often be hired rather than purchased; compare hire fees and damage deposits.', 'Reduces upfront decoration spend. Availability and savings vary — confirm with local hire companies.', 'saves', undefined, true, ['budget', 'hire'], dietL, a11yL)
    );
  }

  // Optional premium ideas only when the reserve is genuinely comfortable.
  if (hasComfortableBuffer) {
    recs.push(
      rec('entertainment', 'Consider a Live Music Element', 'A small acoustic set or local performer can add energy without committing to a full band.', 'Your budget has a comfortable buffer after contingency, so this is an optional upgrade to evaluate.', 'adds', Math.round(budgetSummary.totalBudget * 0.08 * 100) / 100, false, ['music', 'upgrade'], dietL, a11yL)
    );
  }

  return recs;
}

// ----------------------------------------------------------------
// Builder helper — keeps call sites concise and guarantees labeling.
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
    source: 'deterministic',
  };
  if (estimatedCost !== undefined) r.estimatedCost = estimatedCost;
  if (dietL) r.dietaryNote = 'Dietary requirements were considered. Confirm ingredients and cross-contamination controls with the caterer.';
  if (a11yL) r.accessibilityNote = 'Accessibility requirements were noted. Verify details directly with the venue or supplier.';
  return r;
}
