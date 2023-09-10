import { Cell, createConcern } from "kairo";
// import { Location } from "../lib/types";

type Navigator = {
    goto(): void;
    forward():void;
    back():void;
}

export const Navigator = createConcern<Navigator>()('@kairo/router:Navigator');

export const ClientNavigator = Navigator(function*() {
    return {};
});

type Location = {
    pathname: Cell<string>;
    fullPathname: string;
    searchParams: Cell<any>;
    view: Cell<any>;
}

export const Location = createConcern<Location>()('@kairo/router:Location');

export const ClientLocation = Location(function*() {
    return {};
});

type RouterState = {
    /**
     * 
     */
    getLoaderData<T>():T;
    /**
     * 
     * @param id 
     * @param options 
     */
    defineSearchParam<T>(id:string, options?: { parse:Function, stringify: Function }): [Cell<T>,(value:T)=>void];
}

export const RouterState = createConcern<RouterState>()('@kairo/router:RouterState');
