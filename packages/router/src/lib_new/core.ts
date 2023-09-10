import { createConcern, createModule, Module } from 'kairo';

interface RoutePage<View> {
  routes?: RouteConfiguration<any>[];
  view: View;
  module: Module<any, {}, any>;
  loader: any;
}

type WithModule<Deps, Provide> = {
  module: Module<Deps, any, Provide>;
};

type WithRoutes<Routes> = {
  routes: Routes;
};

type WithPage<Page> = {
  page: Page | (() => Promise<Page>);
};

type GetRoutePageDeps<T> = T extends WithModule<infer C, infer P>
  ?
      | 'clear'
      | C
      | Exclude<
          T extends WithRoutes<infer Routes>
            ? Routes extends WithPage<infer Page>[]
              ? GetRoutePageDeps<Page>
              : never
            : never,
          P
        >
  : never;

type RouteConfiguration<Page extends RoutePage<any>> = {
  path: `**` | `/${string}`;
} & WithPage<Page>;

const ccc1 = createConcern<number>()('Concenr1');
const ccc2 = createConcern<number>()('Concenr2');
const ccc3 = createConcern<number>()('Concenr3');

const p2 = {
  view: 0,
  loader: 0,
  module: createModule((x) =>
    x.add(
      ccc1(function* () {
        // const p = yield* ccc3;
        const p2 = yield* ccc1;

        return 1;
      })
    )
  ),
};

const p = {
  view: 0,
  loader: 0,
  routes: [
    {
      path: '**',
      page: () => Promise.resolve(p2),
    },
  ],
  module: createModule((x) =>
    x.add(
      ccc1(function* () {
        // const p = yield* ccc2;

        return 1;
      })
    )
  ),
};

type KK = GetRoutePageDeps<typeof p>;

function createClientRouter<View>(host: any) {
  return function (
    entryPage: RoutePage<View>,
    options: Partial<{
      transferState: string;
    }>
  ) {
    // prepare Location concern
  };
}

function createServerRouter<View>() {
  return async function (entryPage: RoutePage<View>, url: string) {
    let current = entryPage;
    while(true) {
        const data = await current.loader();// TODO: how does data get injected?
        // if nothing to match(no sub routes), break
        if(!current.routes) {
            break;
        }
        // match route
        // construct current page module (with loader data ready)
        // current.loader
    }
    // now all required loader is ok, start connect to view

    return {
      transferState: '',
      view: entryPage.view,
      // redirectTo
    };
  };
}
