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
        <span title="Verified"></span>
        <span aria-label="Supporter"></span>
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
