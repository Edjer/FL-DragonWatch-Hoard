export type SectionState = 'present' | 'loading' | 'missing';

export interface FetLifeRelationship {
  category: 'relationship' | 'ds';
  type: string;
  username: string | null;
  profileUrl: string | null;
}

export interface FetLifeGroup {
  fetlifeGroupId: string;
  name: string;
  role: 'leader' | 'member';
  url: string;
}

export interface FetLifeEvent {
  name: string;
  url: string;
  status: 'going' | 'interested';
  displayDate: string | null;
}

export interface FetLifeFetish {
  fetlifeFetishId: string | null;
  name: string;
  detail: string | null;
  category: 'into' | 'curious_about' | 'soft_limit' | 'hard_limit';
}

export interface FetLifeProfileSnapshot {
  source: {
    url: string;
    capturedAt: string;
  };
  identity: {
    fetlifeUserId: string | null;
    username: string;
    profileUrl: string;
  };
  profile: {
    demographicsRaw: string | null;
    age: number | null;
    gender: string | null;
    headlineRole: string | null;
    verified: boolean;
    supporter: boolean;
    location: {
      city: string | null;
      region: string | null;
      country: string | null;
    };
    orientation: string[];
    pronouns: string[];
    roles: string[];
    active: string | null;
    lookingFor: string[];
    joined: {
      raw: string | null;
      year: number | null;
      month: number | null;
    };
  };
  social: {
    friends: number | null;
    followers: number | null;
    following: number | null;
  };
  relationships: FetLifeRelationship[];
  groups: {
    leading: FetLifeGroup[];
    memberOf: FetLifeGroup[];
  };
  events: {
    going: FetLifeEvent[];
    interested: FetLifeEvent[];
  };
  fetishes: {
    into: FetLifeFetish[];
    curiousAbout: FetLifeFetish[];
    softLimits: FetLifeFetish[];
    hardLimits: FetLifeFetish[];
  };
  about: {
    text: string | null;
  };
  sections: {
    header: SectionState;
    relationships: SectionState;
    groups: SectionState;
    events: SectionState;
    fetishes: SectionState;
    about: SectionState;
    social: SectionState;
  };
  warnings: string[];
}

export interface ProfileExtractionResult {
  detected: boolean;
  snapshot: FetLifeProfileSnapshot | null;
  warnings: string[];
}
