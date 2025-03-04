// We're inlining our own version of qss here for compression's sake, but we've included it as a hard dependency for the MIT license it requires.
// Types are naive, but at least it compiles!

// Unreserved characters for URL encoding are: - . _ ~
// Earlier versions of this library used a different encoding for strings, but in our version we use a period for the string delimiter.
const stringPrefix = '.'

export function stringify(v: any): string {
  function encode(s: any) {
    return !/[^\w-.]/.test(s)
      ? s
      : s.replace(/[^\w-.]/g, function (ch: any) {
          if (ch === '$') return '!'
          ch = ch.charCodeAt(0)
          // thanks to Douglas Crockford for the negative slice trick
          return ch < 0x100
            ? '*' + ('00' + ch.toString(16)).slice(-2)
            : '**' + ('0000' + ch.toString(16)).slice(-4)
        })
  }

  var tmpAry

  switch (typeof v) {
    case 'number':
      return isFinite(v) ? '~' + v : '~null'
    case 'boolean':
      return '~' + v
    case 'string':
      return '~' + stringPrefix + encode(v)
    case 'object':
      if (!v) return '~null'

      tmpAry = []

      if (Array.isArray(v)) {
        for (var i = 0; i < v.length; i++) {
          tmpAry[i] = stringify(v[i]!) || '~null'
        }

        return '~(' + (tmpAry.join('') || '~') + ')'
      } else {
        for (var key in v) {
          if (v.hasOwnProperty(key)) {
            var val = stringify(v[key]!)

            // skip undefined and functions
            if (val) {
              tmpAry.push(encode(key) + val)
            }
          }
        }

        return '~(' + tmpAry.join('~') + ')'
      }
    default:
      // function, undefined
      return ''
  }
}

var reserved: Record<string, boolean | null> = {
  true: true,
  false: false,
  null: null,
} as const

export function parse(s: string): unknown {
  if (!s) return s
  s = s.replace(/%(25)*27/g, stringPrefix)
  var i = 0,
    len = s.length

  function eat(expected: any) {
    if (s.charAt(i) !== expected) {
      // throw new Error(
      //   'bad JSURL syntax: expected ' +
      //     expected +
      //     ', got ' +
      //     (s && s.charAt(i)),
      // )
      throw new Error()
    }
    i++
  }

  function decode() {
    var beg = i,
      ch,
      r = ''
    while (i < len && (ch = s.charAt(i)) !== '~' && ch !== ')') {
      switch (ch) {
        case '*':
          if (beg < i) r += s.substring(beg, i)
          if (s.charAt(i + 1) === '*')
            (r += String.fromCharCode(parseInt(s.substring(i + 2, i + 6), 16))),
              (beg = i += 6)
          else
            (r += String.fromCharCode(parseInt(s.substring(i + 1, i + 3), 16))),
              (beg = i += 3)
          break
        case '!':
          if (beg < i) r += s.substring(beg, i)
          ;(r += '$'), (beg = ++i)
          break
        default:
          i++
      }
    }
    return r + s.substring(beg, i)
  }

  return (function parseOne(): any {
    var result: any, ch, beg
    eat('~')
    switch ((ch = s.charAt(i))) {
      case '(':
        i++
        if (s.charAt(i) === '~') {
          result = []
          if (s.charAt(i + 1) === ')') i++
          else {
            do {
              result.push(parseOne())
            } while (s.charAt(i) === '~')
          }
        } else {
          result = {}
          if (s.charAt(i) !== ')') {
            do {
              var key = decode()
              result[key] = parseOne()
            } while (s.charAt(i) === '~' && ++i)
          }
        }
        eat(')')
        break
      case stringPrefix:
        i++
        result = decode()
        break
      default:
        beg = i++
        while (i < len && /[^)~]/.test(s.charAt(i))) i++
        var sub: string = s.substring(beg, i)
        if (/[\d\-]/.test(ch)) {
          result = parseFloat(sub)
        } else {
          result = reserved[sub]
          if (typeof result === 'undefined') {
            // throw new Error('bad value keyword: ' + sub)
            throw new Error()
          }
        }
    }
    return result
  })()
}

export function tryParse<T>(s: string, def: any): unknown | T {
  try {
    return parse(s)
  } catch (ex) {
    return def
  }
}
