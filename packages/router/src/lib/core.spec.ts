import {
  createPathMatcher,
  findMatch,
  compareMatch,
  resolvePath,
  parseQuery,
  stringfyQuery,
} from './core';

describe('core', () => {
  describe('createPathMatcher', () => {
    it('case 0', () => {
      expect(
        createPathMatcher({
          path: '/',
          exact: false,
        })('/')
      ).toStrictEqual({
        pathname: '/',
        params: {},
        basepath: '/',
      });
    });

    it('case 1', () => {
      expect(
        createPathMatcher({
          path: '*',
          exact: false,
        })('/test')
      ).toStrictEqual({
        pathname: '/test',
        params: {},
        basepath: '/',
      });
    });

    it('case 2', () => {
      expect(
        createPathMatcher({
          path: '/page',
          exact: false,
        })('/page')
      ).toStrictEqual({
        pathname: '/',
        params: {},
        basepath: '/page',
      });
    });

    it('case 3', () => {
      expect(
        createPathMatcher({
          path: '/page',
          exact: false,
        })('/page1')
      ).toStrictEqual(null);
    });

    it('case 4', () => {
      expect(
        createPathMatcher({
          path: '/page/:id',
          exact: false,
        })('/page')
      ).toStrictEqual(null);
    });

    it('case 5.1', () => {
      expect(
        createPathMatcher({
          path: '/:id',
          exact: false,
        })('/11')
      ).toStrictEqual({
        pathname: '/',
        params: {
          id: '11',
        },
        basepath: '/11',
      });
    });

    it('case 5', () => {
      expect(
        createPathMatcher({
          path: '/page/:id',
          exact: false,
        })('/page/11/12')
      ).toStrictEqual({
        pathname: '/12',
        params: {
          id: '11',
        },
        basepath: '/page/11',
      });
    });

    it('case 6', () => {
      expect(
        createPathMatcher({
          path: '/page/:id',
          exact: true,
        })('/page/11/12')
      ).toStrictEqual(null);
    });
  });

  describe('findMatch', () => {
    it('should pass', () => {
      const { route, result } = findMatch(
        [
          {
            path: '/',
            component: 1,
          },
          {
            path: '/1',
            component: 2,
          },
        ],
        '/1'
      );
      expect(route).toStrictEqual({
        path: '/',
        component: 1,
      });
      expect(result).toStrictEqual({
        params: {},
        pathname: '/1',
        basepath: '/'
      })

      expect(findMatch(
        [
          {
            path: '/',
            component: 1,
          },
          {
            path: '/1',
            component: 2,
          },
        ],
        '/'
      ).result).toStrictEqual({
        pathname: '/',
        basepath: '/',
        params: {}
      });


      expect(findMatch(
        [
          {
            path: '/:id',
            component: 1,
          },
          {
            path: '/1',
            component: 2,
          },
        ],
        '/1'
      ).result).toStrictEqual({
        pathname: '/',
        basepath: '/1',
        params: { id: '1' }
      });
    });

    it('should throw', () => {
      expect(() => {
        debugger;
        findMatch(
          [
            {
              path: '/',
              component: 1,
              exact: true,
            },
            {
              path: '/1',
              component: 2,
            },
          ],
          '/2'
        );
      }).toThrow();
    });
  });

  describe('compareMatch', () => {
    it('should pass', () => {
      expect(
        compareMatch(
          {
            result: { pathname: '/', params: {}, basepath: '' },
            route: {},
          },
          {
            result: { pathname: '/', params: {}, basepath: '' },
            route: {},
          }
        )
      ).toBeTruthy();
      expect(
        compareMatch(
          {
            result: { pathname: '/', params: { a: '1' }, basepath: '' },
            route: {},
          },
          {
            result: { pathname: '/', params: { a: '2' }, basepath: '' },
            route: {},
          }
        )
      ).toBeTruthy();
      expect(
        compareMatch(
          {
            result: { pathname: '/', params: {}, basepath: '' },
            route: {},
          },
          {
            result: { pathname: '/2', params: {}, basepath: '' },
            route: {},
          }
        )
      ).toBeFalsy();
      expect(
        compareMatch(
          {
            result: { pathname: '/', params: { a: '1' }, basepath: '' },
            route: { isolated: true },
          },
          {
            result: { pathname: '/', params: { a: '2' }, basepath: '' },
            route: { isolated: true },
          }
        )
      ).toBeFalsy();
      expect(
        compareMatch(
          {
            result: { pathname: '/', params: { a: '1' }, basepath: '' },
            route: { isolated: true },
          },
          {
            result: { pathname: '/', params: { a: '1', b: '2' }, basepath: '' },
            route: { isolated: true },
          }
        )
      ).toBeFalsy();
      expect(
        compareMatch(
          {
            result: { pathname: '/', params: { a: '1' }, basepath: '' },
            route: { isolated: true },
          },
          {
            result: { pathname: '/', params: { a: '1' }, basepath: '' },
            route: { isolated: true },
          }
        )
      ).toBeTruthy();
    });
  });

  describe('resolvePath', () => {
    it('should pass', () => {
      expect(resolvePath('/path', '/basename')).toBe('/path');
      expect(resolvePath('/path/', '/basename')).toBe('/path/');
      expect(resolvePath('../path', '/basename')).toBe('/path');
      expect(resolvePath('..', '/basename')).toBe('/');
      expect(resolvePath('./', '/basename')).toBe('/basename');
      expect(resolvePath('.', '/basename')).toBe('/basename');
      expect(resolvePath('', '/basename')).toBe('/basename');
      expect(resolvePath('./path', '/basename')).toBe('/basename/path');
      expect(resolvePath('path', '/basename')).toBe('/basename/path');
    });

    it('shoud throw', () => {
      expect(() => resolvePath('../..', '/basename')).toThrow(); // 122
      expect(() => resolvePath('../../path', '/basename')).toThrow(); // 122
      expect(() => resolvePath('path/..', '/basename')).toThrow(); // 115
      expect(() => resolvePath('././path2', '/basename')).toThrow(); // 109
      expect(() => resolvePath('./.././path2', '/basename')).toThrow(); // 115
      expect(() => resolvePath('.././path', '/basename')).toThrow(); // 110
      expect(() => resolvePath('./../', '/basename')).toThrow(); // 115
      expect(() => resolvePath('./..', '/basename')).toThrow(); // 115
    });
  });

  describe('parseQuery', () => {
    it('should pass', () => {
      expect(parseQuery('a=1&b=2')).toStrictEqual({ a: '1', b: '2' });
      expect(parseQuery('a=1&b=')).toStrictEqual({ a: '1', b: '' });
      expect(parseQuery('a=1&a=')).toStrictEqual({ a: '' });
    });
  });

  describe('stringfyQuery', () => {
    it('should pass', () => {
      expect(stringfyQuery({ a: '1', b: '2' })).toBe('a=1&b=2');
    });
  });
});
