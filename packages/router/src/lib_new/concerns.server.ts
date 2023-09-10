import { Location } from "./concerns";

const ServerLocation = Location(function*() {
    return {};
});

const ServerDerivedLocation = Location(function*(props:{
    matchingRoute: {
        path: string
    }
}) {
    const parent = yield* Location;
    return {};
})