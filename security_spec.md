# IE MATRIX Security Specification

## 1. Data Invariants
- A User profile must be uniquely identified by their Firebase Auth UID.
- Only admins or the owner of the profile can modify user data.
- Standard students cannot escalate their privileges to 'admin'.
- Every write must include mandatory fields verified against the predefined schema.
- All timestamps must be server-generated.

## 2. Relational Logic
- Ratings are linked to Subjects.
- Progress is unique per user.
- Resource access is determined by visibility (public) or ownership.

## 3. The "Dirty Dozen" Payloads (Anti-Tests)

### Identity Spoofing
1. **P1: Target Profile Hijack**
   Create a document in `/users/attacker_uid` with `uid: "victim_uid"`.
   *EXPECTED: PERMISSION_DENIED*
2. **P2: Admin Privilege Escalation**
   Update a student profile to `role: "admin"`.
   *EXPECTED: PERMISSION_DENIED*

### Integrity Violation
3. **P3: Shadow Field Injection**
   Add `isVerified: true` to a user profile created via client.
   *EXPECTED: PERMISSION_DENIED*
4. **P4: Immortal Field Mutation**
   Attempt to change `createdAt` on a resource.
   *EXPECTED: PERMISSION_DENIED*
5. **P5: Identity Poisoning**
   Create a user document with an ID containing malicious characters (e.g., `../scripts/hack`).
   *EXPECTED: PERMISSION_DENIED*

### State & Resource Abuse
6. **P6: Denial of Wallet (Resource Exhaustion)**
   Send a 1MB string into a `fullName` field.
   *EXPECTED: PERMISSION_DENIED*
7. **P7: Orphaned Relation**
   Create a Rating for a Subject ID that does not exist.
   *EXPECTED: PERMISSION_DENIED*
8. **P8: Timestamp Forgery**
   Send a client-side timestamp for `updatedAt` instead of `serverTimestamp()`.
   *EXPECTED: PERMISSION_DENIED*

### Unauthorized Access
9. **P9: PII Leak Attempt**
   Reading a non-owner's profile when not an admin.
   *EXPECTED: PERMISSION_DENIED*
10. **P10: Private Resource Scraping**
    List all resources where `isPublic` is false.
    *EXPECTED: PERMISSION_DENIED*
11. **P11: Anonymous Write**
    Attempt to create a rating without being signed in.
    *EXPECTED: PERMISSION_DENIED*
12. **P12: Email Verification Bypass**
    Wait for an auth token with `email_verified: false` for a write operation.
    *EXPECTED: PERMISSION_DENIED*
