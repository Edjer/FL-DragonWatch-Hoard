// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';
import { extractFetLifeProfile, isFetLifeProfilePage } from '@/content/fetlife-profile-extractor';
import fixture from './fixtures/fetlife-profile-full.html?raw';

const sourceUrl = 'https://fetlife.example/ExampleUser';

describe('FetLife profile extractor', () => {
  it('extracts normalized profile data from the visible page', () => {
    document.body.innerHTML = fixture;
    const result = extractFetLifeProfile(document, sourceUrl, '2026-09-07T17:00:00Z');
    expect(isFetLifeProfilePage(document)).toBe(true);
    expect(result.snapshot).not.toBeNull();
    const snapshot = result.snapshot;
    if (!snapshot) throw new Error('Expected profile snapshot');
    expect(snapshot.identity).toMatchObject({ fetlifeUserId: '141464', username: 'ExampleUser' });
    expect(snapshot.profile).toMatchObject({
      demographicsRaw: '54M Dragon',
      age: 54,
      gender: 'M',
      headlineRole: 'Dragon',
    });
    expect(snapshot.profile.location).toEqual({
      city: 'Example City',
      region: 'Example Region',
      country: 'United States',
    });
    expect(snapshot.profile.joined).toEqual({ raw: 'March 2009', year: 2009, month: 3 });
    expect(snapshot.social).toEqual({ friends: 174, followers: 152, following: 218 });
    expect(snapshot.profile.roles).toEqual([
      'Dragon',
      'Daddy Dom',
      'Sadist',
      'Brat Wrangler',
      'Master',
    ]);
    expect(snapshot.profile.orientation).toEqual(['Pansexual']);
    expect(snapshot.profile.pronouns).toEqual(['He/Him']);
    expect(snapshot.relationships).toHaveLength(4);
    expect(snapshot.relationships).toContainEqual({
      category: 'ds',
      type: 'Dragon of',
      username: 'AnotherUser',
      profileUrl: 'https://fetlife.example/AnotherUser',
    });
    expect(snapshot.groups.leading[0]).toMatchObject({ fetlifeGroupId: '245684', role: 'leader' });
    expect(snapshot.groups.memberOf[0]).toMatchObject({ fetlifeGroupId: '57327', role: 'member' });
    expect(snapshot.events.going[0]).toMatchObject({
      name: 'Example Going Event',
      status: 'going',
    });
    expect(snapshot.events.interested[0]).toMatchObject({
      name: 'Example Interested Event',
      status: 'interested',
    });
    expect(snapshot.fetishes.into[0]).toMatchObject({
      fetlifeFetishId: '290',
      name: 'Bare Bottom Spanking',
      detail: 'giving',
      category: 'into',
    });
    expect(snapshot.fetishes.hardLimits[0]).toMatchObject({
      fetlifeFetishId: '976',
      name: 'Race Play',
      category: 'hard_limit',
    });
    expect(snapshot.about.text).toContain('Line one.');
    expect(snapshot.sections).toMatchObject({
      header: 'present',
      relationships: 'present',
      groups: 'present',
      events: 'present',
      fetishes: 'present',
      about: 'present',
    });
    expect(result.warnings).toContain('Skipped a group with a malformed URL.');
    expect(result.warnings).toContain('Skipped a fetish with a malformed URL.');
  });

  it('reports loading frames without treating them as empty data', () => {
    document.body.innerHTML =
      '<section data-test-id="profile-header" data-profile-id="141464"><h1 data-test-id="profile-username">ExampleUser</h1><p data-test-id="profile-joined">Joined 2009 #141464</p></section><turbo-frame id="profile-events" aria-busy="true"></turbo-frame>';
    const snapshot = extractFetLifeProfile(document, sourceUrl).snapshot;
    expect(snapshot?.profile.joined).toEqual({ raw: '2009', year: 2009, month: null });
    expect(snapshot?.sections.events).toBe('loading');
    expect(snapshot?.events.going).toEqual([]);
    expect(snapshot?.warnings).toContain('The events section is still loading.');
  });

  it('classifies real FetLife group frames and event headings', () => {
    document.body.innerHTML = `
      <header data-test-id="profile-header">
        <h1>ExampleUser</h1>
        <p>Joined March 2009 #141464</p>
        <div class="profile-interests">
          <span>Interested in</span>
          <div>
            <a href="/interests/play-partner">Play Partner</a>
            <a href="/interests/friendship">Friendship</a>
            <a href="/interests/mentor-teacher">Mentor / Teacher</a>
            <a href="/interests/mentee-student">Mentee / Student</a>
            <a href="/interests/community">Community</a>
            <a href="/interests/events">Events</a>
          </div>
        </div>
      </header>
      <turbo-frame id="profile-groups-leading">
        <ul><li><a href="/groups/245684">Example Leaders</a></li></ul>
      </turbo-frame>
      <turbo-frame id="profile-groups-member_of">
        <ul><li><a href="/groups/57327">Example Members</a></li></ul>
      </turbo-frame>
      <div data-profile-events>
        <section>
          <h4>Events Going to</h4>
          <ul><li><a href="/events/example-going">Example Going Event<div>Sep 9, 2026 6:30 PM</div></a></li></ul>
        </section>
        <section>
          <h4>Events Interested In</h4>
          <ul><li><a href="/events/example-interested">Example Interested Event</a></li></ul>
        </section>
      </div>
    `;

    const snapshot = extractFetLifeProfile(document, sourceUrl).snapshot;
    expect(snapshot?.groups.leading).toMatchObject([
      { fetlifeGroupId: '245684', name: 'Example Leaders', role: 'leader' },
    ]);
    expect(snapshot?.groups.memberOf).toMatchObject([
      { fetlifeGroupId: '57327', name: 'Example Members', role: 'member' },
    ]);
    expect(snapshot?.events.going.map((event) => event.name)).toEqual(['Example Going Event']);
    expect(snapshot?.events.going[0]?.displayDate).toBe('Sep 9, 2026 6:30 PM');
    expect(snapshot?.events.interested.map((event) => event.name)).toEqual([
      'Example Interested Event',
    ]);
    expect(snapshot?.profile.lookingFor).toEqual([
      'Play Partner',
      'Friendship',
      'Mentor / Teacher',
      'Mentee / Student',
      'Community',
      'Events',
    ]);
  });

  it('extracts unlabeled real profile header facts, badges, social counts, and relationships', () => {
    document.body.innerHTML = `
      <header data-test-id="profile-header">
        <h1>ExampleUser</h1>
        <div>54M Dragon</div>
        <div>Joined March 2009 #141464</div>
        <div>Location: Example City, Example Region, United States</div>
        <a title="174 Friends" href="/ExampleUser/friends">174</a>
        <a title="152 Followers" href="/ExampleUser/followers">152</a>
        <a title="218 Following" href="/ExampleUser/following">218</a>
        <a href="/verify" data-original-title="Verified Profile"><svg><use href="#icon-verified"></use></svg></a>
        <a href="/support" title="FetLife Supporter"><svg><use href="#icon-devil-heart"></use></svg></a>
        <div>Active</div>
        <div><span>Relationships</span><div>Nesting Partner with <a href="/OtherUser">OtherUser</a></div></div>
      </header>
    `;

    const snapshot = extractFetLifeProfile(document, sourceUrl).snapshot;
    expect(snapshot?.identity.username).toBe('ExampleUser');
    expect(snapshot?.profile).toMatchObject({
      demographicsRaw: '54M Dragon',
      age: 54,
      gender: 'M',
      headlineRole: 'Dragon',
      verified: true,
      supporter: true,
      active: 'Active',
      location: { city: 'Example City', region: 'Example Region', country: 'United States' },
      joined: { raw: 'March 2009', year: 2009, month: 3 },
    });
    expect(snapshot?.social).toEqual({ friends: 174, followers: 152, following: 218 });
    expect(snapshot?.relationships).toContainEqual({
      category: 'relationship',
      type: 'Nesting Partner with',
      username: 'OtherUser',
      profileUrl: 'https://fetlife.example/OtherUser',
    });
  });

  it('keeps each real relationship row independent', () => {
    document.body.innerHTML = `
      <header data-test-id="profile-header">
        <h1>ExampleUser</h1>
        <p>Joined March 2009 #141464</p>
      </header>
      <turbo-frame id="profile-relations">
        <section>
          <h3>Relationships</h3>
          <div class="relationship-row"><span>Polyamorous Nesting Partner with</span><a href="/RascallyORB">RascallyORB</a></div>
          <div class="relationship-row"><span>Member of a House with</span><a href="/DomusDracoFeles">DomusDracoFeles</a></div>
          <div class="relationship-row"><span>Widower of</span><a href="/Theodora54">Theodora54</a></div>
        </section>
        <section>
          <h3>D/s relationships</h3>
          <div class="relationship-row"><span>Daddy of</span><a href="/RascallyORB">RascallyORB</a></div>
          <div class="relationship-row"><span>Protecting</span><a href="/princepupp">princepupp</a></div>
        </section>
      </turbo-frame>
    `;

    const relationships = extractFetLifeProfile(document, sourceUrl).snapshot?.relationships ?? [];
    expect(relationships).toEqual([
      {
        category: 'relationship',
        type: 'Polyamorous Nesting Partner with',
        username: 'RascallyORB',
        profileUrl: 'https://fetlife.example/RascallyORB',
      },
      {
        category: 'relationship',
        type: 'Member of a House with',
        username: 'DomusDracoFeles',
        profileUrl: 'https://fetlife.example/DomusDracoFeles',
      },
      {
        category: 'relationship',
        type: 'Widower of',
        username: 'Theodora54',
        profileUrl: 'https://fetlife.example/Theodora54',
      },
      {
        category: 'ds',
        type: 'Daddy of',
        username: 'RascallyORB',
        profileUrl: 'https://fetlife.example/RascallyORB',
      },
      {
        category: 'ds',
        type: 'Protecting',
        username: 'princepupp',
        profileUrl: 'https://fetlife.example/princepupp',
      },
    ]);
  });

  it('does not mistake role tooltip prose for the profile location', () => {
    document.body.innerHTML = `
      <header data-test-id="profile-header">
        <h1>ExampleUser</h1>
        <p>54M Dragon</p>
        <p>Joined March 2009 #141464</p>
        <div class="profile-location-value">Lehighton, PA, United States</div>
        <div class="role-help" title="Usually refers to someone masculine-identifying who enjoys taking on a nurturing, paternal figure role while also leading and taking control in a power exchange dynamic."></div>
      </header>
    `;

    expect(extractFetLifeProfile(document, sourceUrl).snapshot?.profile.location).toEqual({
      city: 'Lehighton',
      region: 'PA',
      country: 'United States',
    });
  });

  it('extracts real location links and splits fetishes into capped categories', () => {
    const intoRows = Array.from(
      { length: 76 },
      (_, index) => `<li><a href="/fetishes/${index + 1}">Into ${index + 1}</a></li>`,
    ).join('');
    document.body.innerHTML = `
      <header data-test-id="profile-header">
        <h1>ExampleUser</h1>
        <p>Joined March 2009 #141464</p>
        <div class="profile-location">
          <a href="/locations/example-city">Example City</a>
          <a href="/locations/example-region">Example Region</a>
          <a href="/locations/example-country">United States</a>
        </div>
      </header>
      <section data-profile-fetishes>
        <h3>Into</h3><ul>${intoRows}</ul>
        <h3>Curious About</h3><ul><li><a href="/fetishes/200">Rope</a></li></ul>
        <h3>Soft Limits</h3><ul><li><a href="/fetishes/201">Needles</a></li></ul>
        <h3>Hard Limits</h3><ul><li><a href="/fetishes/202">Race Play</a></li></ul>
      </section>
    `;

    const result = extractFetLifeProfile(document, sourceUrl);
    const snapshot = result.snapshot;
    expect(snapshot?.profile.location).toEqual({
      city: 'Example City',
      region: 'Example Region',
      country: 'United States',
    });
    expect(snapshot?.fetishes.into).toHaveLength(75);
    expect(snapshot?.fetishes.curiousAbout[0]).toMatchObject({
      name: 'Rope',
      category: 'curious_about',
    });
    expect(snapshot?.fetishes.softLimits[0]).toMatchObject({
      name: 'Needles',
      category: 'soft_limit',
    });
    expect(snapshot?.fetishes.hardLimits[0]).toMatchObject({
      name: 'Race Play',
      category: 'hard_limit',
    });
    expect(result.warnings).toContain('Fetish capture capped at 75 items per category.');
  });

  it('rejects conflicting and missing stable IDs without guessing', () => {
    document.body.innerHTML =
      '<section data-test-id="profile-header" data-profile-id="141464"><h1 data-test-id="profile-username">ExampleUser</h1><p data-test-id="profile-joined">Joined 2009 #141464</p></section><turbo-frame id="profile_events_999999"></turbo-frame>';
    let result = extractFetLifeProfile(document, sourceUrl);
    expect(result.snapshot?.identity.fetlifeUserId).toBeNull();
    expect(result.warnings).toContain('Conflicting FetLife profile ID candidates detected.');

    document.body.innerHTML =
      '<section data-test-id="profile-header"><h1 data-test-id="profile-username">ExampleUser</h1></section>';
    result = extractFetLifeProfile(document, sourceUrl);
    expect(result.snapshot?.identity.fetlifeUserId).toBeNull();
    expect(result.warnings).toContain('No stable FetLife profile ID could be determined.');
  });

  it('does not identify arbitrary pages as profiles', () => {
    document.body.innerHTML = '<main><a href="/ExampleUser">ExampleUser</a></main>';
    const result = extractFetLifeProfile(document, sourceUrl);
    expect(isFetLifeProfilePage(document)).toBe(false);
    expect(result).toEqual({ detected: false, snapshot: null, warnings: [] });
  });
});
