# LEGAL.md — what this project is and is not, legally

TicketRouter is a free static website that, given *where a stop happened*,
points a person at the official Nebraska court or DMV page they must use
themselves. It does not search, store, or interpret anyone's tickets.

## Not legal advice

TicketRouter is a directory of official Nebraska court and DMV pages. It does
not tell anyone what to do about a ticket, whether to contest one, or how a
ticket affects insurance. Contributors must not add case-specific advice to
data, copy, or docs.

## Not a consumer report

This is not a consumer report under the Fair Credit Reporting Act and may not
be used for employment, housing, credit, or insurance decisions. We assemble no
files on any person.

## We do not pull DMV motor vehicle records

We link to the Nebraska DMV's official own-record request page. We never
request, receive, or store anyone's motor vehicle record. The federal Driver's
Privacy Protection Act (18 U.S.C. §§ 2721–2725) and Nebraska's Uniform Motor
Vehicle Records Disclosure Act restrict who may obtain motor vehicle records
and for what purposes. Our architecture — client-side routing with no identity
inputs — exists so that a permitted-use request (e.g., your own record) happens
only between you and the official DMV page, never through us.

## Self-check only

This tool is designed for checking your own situation. It is not a
people-search product, and contributions that enable searching other people
will be refused.

## Data hygiene

Every routed row carries `source_url`, `last_verified`, and a `verification`
status. Rows below `link_ok` never route. A wrong confident link is worse than
no link: when a source goes dark, mark it `disabled`, never silently substitute.

## License

Apache-2.0. See LICENSE.
