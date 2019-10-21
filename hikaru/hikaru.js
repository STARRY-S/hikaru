'use strict'

const fse = require('fs-extra')
const path = require('path')
const {URL} = require('url')
const cheerio = require('cheerio')

const yaml = require('js-yaml')
const nunjucks = require('nunjucks')
const marked = require('marked')
const stylus = require('stylus')
const nib = require('nib')

const Logger = require('./logger')
const Renderer = require('./renderer')
const Processor = require('./processor')
const Generator = require('./generator')
const Translator = require('./translator')
const Router = require('./router')
const types = require('./types')
const {Site, File, Category, Tag} = types
const highlight = require('./highlight')
const utils = require('./utils')
const {
  isArray,
  isString,
  isFunction,
  isObject,
  escapeHTML,
  matchFiles,
  removeControlChars,
  paginate,
  sortCategories,
  paginateCategories,
  getPathFn,
  getURLFn,
  genCategories,
  genTags,
  resolveHeaderIDs,
  resolveLink,
  resolveImage,
  genTOC
} = utils

class Hikaru {
  constructor(isDebug = false) {
    this.isDebug = isDebug
    this.logger = new Logger(this.isDebug)
    this.logger.debug('Hikaru is starting...')
    this.types = types
    this.utils = utils
    process.on('exit', () => {
      this.logger.debug('Hikaru is stopping...')
    })
    if (process.platform === 'win32') {
      require('readline').createInterface({
        'input': process.stdin,
        'output': process.stdout
      }).on('SIGINT', () => {
        process.emit('SIGINT')
      })
    }
    process.on('SIGINT', () => {
      process.exit(0)
    })
  }

  init(workDir, configPath) {
    return fse.mkdirp(workDir).then(() => {
      this.logger.debug(`Hikaru is copying \`${
        this.logger.cyan(configPath || path.join(workDir, 'siteConfig.yml'))
      }\`...`)
      this.logger.debug(`Hikaru is copying \`${
        this.logger.cyan(path.join(workDir, 'package.json'))
      }\`...`)
      this.logger.debug(`Hikaru is creating \`${
        this.logger.cyan(path.join(workDir, 'srcs', path.sep))
      }\`...`)
      this.logger.debug(`Hikaru is creating \`${
        this.logger.cyan(path.join(workDir, 'docs', path.sep))
      }\`...`)
      this.logger.debug(`Hikaru is creating \`${
        this.logger.cyan(path.join(workDir, 'themes', path.sep))
      }\`...`)
      this.logger.debug(`Hikaru is creating \`${
        this.logger.cyan(path.join(workDir, 'scripts', path.sep))
      }\`...`)
      fse.copy(
        path.join(__dirname, '..', 'dist', 'siteConfig.yml'),
        configPath || path.join(workDir, 'siteConfig.yml')
      )
      fse.readFile(
        path.join(__dirname, '..', 'dist', 'package.json')
      ).then((text) => {
        const json = JSON.parse(text)
        // Set package name to site dir name.
        json['name'] = path.relative('..', '.')
        return fse.writeFile(
          path.join(workDir, 'package.json'),
          JSON.stringify(json, null, '  ')
        )
      })
      fse.mkdirp(path.join(workDir, 'srcs'))
      fse.mkdirp(path.join(workDir, 'docs'))
      fse.mkdirp(path.join(workDir, 'themes'))
      fse.mkdirp(path.join(workDir, 'scripts'))
    }).catch((error) => {
      this.logger.warn('Hikaru catched some error during initializing!')
      this.logger.error(error)
    })
  }

  clean(workDir, configPath) {
    configPath = configPath || path.join(workDir, 'siteConfig.yml')
    let siteConfig
    try {
      siteConfig = yaml.safeLoad(fse.readFileSync(configPath, 'utf8'))
    } catch (error) {
      this.logger.warn('Hikaru cannot find site config!')
      this.logger.error(error)
      process.exit(-1)
    }
    if (siteConfig == null || siteConfig['docDir'] == null) {
      return
    }
    matchFiles('*', {
      'cwd': path.join(workDir, siteConfig['docDir']),
      'dot': true
    }).then((res) => {
      return res.map((r) => {
        fse.stat(path.join(workDir, siteConfig['docDir'], r)).then((stats) => {
          if (stats.isDirectory()) {
            this.logger.debug(`Hikaru is removing \`${
              this.logger.cyan(
                path.join(workDir, siteConfig['docDir'], r, path.sep)
              )
            }\`...`)
          } else {
            this.logger.debug(`Hikaru is removing \`${
              this.logger.cyan(
                path.join(workDir, siteConfig['docDir'], r)
              )
            }\`...`)
          }
          return fse.remove(path.join(workDir, siteConfig['docDir'], r))
        })
      })
    }).catch((error) => {
      this.logger.warn('Hikaru catched some error during cleaning!')
      this.logger.error(error)
    })
  }

  async build(workDir, configPath) {
    this.loadSite(workDir, configPath)
    this.loadModules()
    this.loadPlugins()
    await this.loadScripts()
    process.on('unhandledRejection', (error) => {
      this.logger.warn('Hikaru catched some error during building!')
      this.logger.error(error)
      this.logger.warn('Hikaru advise you to check built files!')
    })
    try {
      await this.router.build()
    } catch (error) {
      this.logger.warn('Hikaru catched some error during building!')
      this.logger.error(error)
      this.logger.warn('Hikaru advise you to check built files!')
    }
  }

  async serve(workDir, configPath, ip = 'localhost', port = 2333) {
    if (isString(port)) {
      port = Number.parseInt(port)
    }
    this.loadSite(workDir, configPath)
    this.loadModules()
    this.loadPlugins()
    await this.loadScripts()
    process.on('unhandledRejection', (error) => {
      this.logger.warn('Hikaru catched some error during serving!')
      this.logger.error(error)
    })
    try {
      await this.router.serve(ip, port)
    } catch (error) {
      this.logger.warn('Hikaru catched some error during serving!')
      this.logger.error(error)
    }
  }

  loadSite(workDir, configPath) {
    this.site = new Site(workDir)
    configPath = configPath || path.join(
      this.site['workDir'],
      'siteConfig.yml'
    )
    try {
      this.site['siteConfig'] = yaml.safeLoad(
        fse.readFileSync(configPath, 'utf8')
      )
    } catch (error) {
      this.logger.warn('Hikaru cannot find site config!')
      this.logger.error(error)
      process.exit(-1)
    }
    const siteConfig = this.site['siteConfig']
    siteConfig['srcDir'] = path.join(
      this.site['workDir'], siteConfig['srcDir'] || 'srcs'
    )
    siteConfig['docDir'] = path.join(
      this.site['workDir'], siteConfig['docDir'] || 'docs'
    )
    siteConfig['themeDir'] = path.join(
      this.site['workDir'], siteConfig['themeDir']
    )
    siteConfig['themeSrcDir'] = path.join(
      siteConfig['themeDir'], 'srcs'
    )
    siteConfig['categoryDir'] = siteConfig['categoryDir'] || 'categories'
    siteConfig['tagDir'] = siteConfig['tagDir'] || 'tags'
    const themeConfigPath = path.join(this.site['workDir'], 'themeConfig.yml')
    try {
      this.site['themeConfig'] = yaml.safeLoad(
        fse.readFileSync(themeConfigPath, 'utf8')
      )
    } catch (error) {
      if (error['code'] === 'ENOENT') {
        this.logger.warn('Hikaru continues with a empty theme config...')
        this.site['themeConfig'] = {}
      }
    }
  }

  loadModules() {
    this.renderer = new Renderer(
      this.logger,
      this.site['siteConfig']['skipRender']
    )
    this.processor = new Processor(this.logger)
    this.generator = new Generator(this.logger)
    this.translator = new Translator(this.logger)
    try {
      const defaultLanguage = yaml.safeLoad(fse.readFileSync(path.join(
        this.site['siteConfig']['themeDir'], 'languages', 'default.yml'
      ), 'utf8'))
      this.translator.register('default', defaultLanguage)
    } catch (error) {
      if (error['code'] === 'ENOENT') {
        this.logger.warn(
          'Hikaru cannot find default language file in your theme!'
        )
      }
    }
    this.router = new Router(
      this.logger,
      this.renderer,
      this.processor,
      this.generator,
      this.translator,
      this.site
    )
    try {
      this.registerInternalRenderers()
      this.registerInternalProcessors()
      this.registerInternalGenerators()
    } catch (error) {
      this.logger.warn('Hikaru cannot register internal functions!')
      this.logger.error(error)
      process.exit(-2)
    }
  }

  // Load local plugins for site.
  loadPlugins() {
    const siteJsonPath = path.join(this.site['workDir'], 'package.json')
    if (!fse.existsSync(siteJsonPath)) {
      return
    }
    const plugins = JSON.parse(fse.readFileSync(siteJsonPath, 'utf8'))['dependencies']
    if (plugins == null) {
      return
    }
    return Object.keys(plugins).filter((name) => {
      return /^hikaru-/.test(name)
    }).map((name) => {
      this.logger.debug(`Hikaru is loading plugin \`${
        this.logger.blue(name)
      }\`...`)
      return require(require.resolve(name, {
        'paths': [this.site['workDir'], '.', __dirname]
      }))({
        'logger': this.logger,
        'renderer': this.renderer,
        'processor': this.processor,
        'generator': this.generator,
        'translator': this.translator,
        'types': this.types,
        'utils': this.utils,
        'site': this.site
      })
    })
  }

  // Load local scripts for site and theme.
  async loadScripts() {
    const scripts = (await matchFiles(path.join('**', '*.js'), {
      'nodir': true,
      'cwd': path.join(this.site['workDir'], 'scripts')
    })).map((filename) => {
      return path.join(this.site['workDir'], 'scripts', filename)
    }).concat((await matchFiles(path.join('**', '*.js'), {
      'nodir': true,
      'cwd': path.join(this.site['siteConfig']['themeDir'], 'scripts')
    })).map((filename) => {
      return path.join(this.site['siteConfig']['themeDir'], 'scripts', filename)
    }))
    return scripts.map((name) => {
      this.logger.debug(`Hikaru is loading script \`${
        this.logger.cyan(path.basename(name))
      }\`...`)
      return require(require.resolve(name, {
        'paths': [this.site['workDir'], '.', __dirname]
      }))({
        'logger': this.logger,
        'renderer': this.renderer,
        'processor': this.processor,
        'generator': this.generator,
        'translator': this.translator,
        'types': this.types,
        'utils': this.utils,
        'site': this.site
      })
    })
  }

  registerInternalRenderers() {
    const njkConfig = Object.assign(
      {'autoescape': false, 'noCache': true},
      this.site['siteConfig']['nunjucks']
    )
    const njkEnv = nunjucks.configure(
      this.site['siteConfig']['themeSrcDir'],
      njkConfig
    )
    const njkRenderer = (file) => {
      const template = nunjucks.compile(file['text'], njkEnv, file['srcPath'])
      // For template you must give a render function as content.
      file['content'] = (ctx) => {
        return new Promise((resolve, reject) => {
          template.render(ctx, (error, result) => {
            if (error != null) {
              return reject(error)
            }
            return resolve(result)
          })
        })
      }
      return file
    }
    this.renderer.register('.njk', null, njkRenderer)
    this.renderer.register('.j2', null, njkRenderer)

    this.renderer.register('.html', '.html', (file) => {
      file['content'] = file['text']
      return file
    })

    const markedConfig = Object.assign({
      'gfm': true,
      'langPrefix': '',
      'highlight': (code, lang) => {
        return highlight(code, Object.assign({
          'lang': lang != null? lang.toLowerCase() : null,
          'hljs': true,
          'gutter': true
        }, this.site['siteConfig']['highlight']))
      }
    }, this.site['siteConfig']['marked'])
    marked.setOptions(markedConfig)
    this.renderer.register('.md', '.html', (file) => {
      file['content'] = marked(file['text'])
      return file
    })

    const stylConfig = this.site['siteConfig']['stylus'] || {}
    this.renderer.register('.styl', '.css', (file) => {
      return new Promise((resolve, reject) => {
        stylus(file['text']).use(nib()).use((style) => {
          style.define('getSiteConfig', (data) => {
            const keys = data['val'].toString().trim().split('.')
            let res = this.site['siteConfig']
            for (const k of keys) {
              if (res[k] == null) {
                return null
              }
              res = res[k]
            }
            return res
          })
        }).use((style) => {
          style.define('getThemeConfig', (data) => {
            const keys = data['val'].toString().trim().split('.')
            let res = this.site['themeConfig']
            for (const k of keys) {
              if (res[k] == null) {
                return null
              }
              res = res[k]
            }
            return res
          })
        }).set('filename', path.join(
          this.site['siteConfig']['themeSrcDir'], file['srcPath']
        )).set('sourcemap', stylConfig['sourcemap'])
        .set('compress', stylConfig['compress'])
        .set('include css', true).render((error, result) => {
          if (error != null) {
            return reject(error)
          }
          file['content'] = result
          return resolve(file)
        })
      })
    })
  }

  registerInternalProcessors() {
    this.processor.register('post sequence', (site) => {
      site['posts'].sort((a, b) => {
        return -(a['createdTime'] - b['createdTime'])
      })
      for (let i = 0; i < site['posts'].length; ++i) {
        if (i > 0) {
          site['posts'][i]['next'] = site['posts'][i - 1]
        }
        if (i < site['posts'].length - 1) {
          site['posts'][i]['prev'] = site['posts'][i + 1]
        }
      }
      return site
    })

    this.processor.register('categories collection', (site) => {
      const result = genCategories(site['posts'])
      site['categories'] = result['categories']
      site['categoriesLength'] = result['categoriesLength']
      return site
    })

    this.processor.register('tags collection', (site) => {
      const result = genTags(site['posts'])
      site['tags'] = result['tags']
      site['tagsLength'] = result['tagsLength']
      return site
    })

    this.processor.register('toc and link resolving', (site) => {
      // Preventing cheerio decode `&lt;`.
      // Only work with cheerio version less than or equal to `0.22.0`,
      // which uses `htmlparser2` as its parser.
      const all = site['posts'].concat(site['pages'])
      for (const p of all) {
        p['$'] = cheerio.load(p['content'], {'decodeEntities': false})
        resolveHeaderIDs(p['$'])
        p['toc'] = genTOC(p['$'])
        resolveLink(
          p['$'],
          site['siteConfig']['baseURL'],
          site['siteConfig']['rootDir'],
          p['docPath']
        )
        resolveImage(p['$'], site['siteConfig']['rootDir'], p['docPath'])
        // May change after cheerio switching to `parse5`.
        p['content'] = p['$'].html()
        if (p['content'].indexOf('<!--more-->') !== -1) {
          const split = p['content'].split('<!--more-->')
          p['excerpt'] = split[0]
          p['more'] = split[1]
          p['content'] = split.join('<a id=\'more\'></a>')
        }
      }
      return site
    })
  }

  registerInternalGenerators() {
    this.generator.register('index pages', (site) => {
      let perPage
      if (isObject(site['siteConfig']['perPage'])) {
        perPage = site['siteConfig']['perPage']['index'] || 10
      } else {
        perPage = site['siteConfig']['perPage'] || 10
      }
      return paginate(new File({
        'layout': 'index',
        'docDir': site['siteConfig']['docDir'],
        'docPath': path.join(site['siteConfig']['indexDir'], 'index.html'),
        'title': 'index',
        'comment': false,
        'reward': false
      }), site['posts'], perPage)
    })

    this.generator.register('archives pages', (site) => {
      let perPage
      if (isObject(site['siteConfig']['perPage'])) {
        perPage = site['siteConfig']['perPage']['archives'] || 10
      } else {
        perPage = site['siteConfig']['perPage'] || 10
      }
      return paginate(new File({
        'layout': 'archives',
        'docDir': site['siteConfig']['docDir'],
        'docPath': path.join(site['siteConfig']['archiveDir'], 'index.html'),
        'title': 'archives',
        'comment': false,
        'reward': false
      }), site['posts'], perPage)
    })

    this.generator.register('categories pages', (site) => {
      let results = []
      let perPage
      if (isObject(site['siteConfig']['perPage'])) {
        perPage = site['siteConfig']['perPage']['category'] || 10
      } else {
        perPage = site['siteConfig']['perPage'] || 10
      }
      for (const sub of site['categories']) {
        sortCategories(sub)
        results = results.concat(paginateCategories(
          sub, site['siteConfig']['categoryDir'], site, perPage
        ))
      }
      results.push(new File({
        'layout': 'categories',
        'docDir': site['siteConfig']['docDir'],
        'docPath': path.join(site['siteConfig']['categoryDir'], 'index.html'),
        'title': 'categories',
        'comment': false,
        'reward': false
      }))
      return results
    })

    this.generator.register('tags pages', (site) => {
      let results = []
      let perPage
      if (isObject(site['siteConfig']['perPage'])) {
        perPage = site['siteConfig']['perPage']['tag'] || 10
      } else {
        perPage = site['siteConfig']['perPage'] || 10
      }
      for (const tag of site['tags']) {
        tag['posts'].sort((a, b) => {
          return -(a['date'] - b['date'])
        })
        const sp = new File({
          'layout': 'tag',
          'docDir': site['siteConfig']['docDir'],
          'docPath': path.join(
            site['siteConfig']['tagDir'], `${tag['name']}`, 'index.html'
          ),
          'title': 'tag',
          'name': tag['name'].toString(),
          'comment': false,
          'reward': false
        })
        tag['docPath'] = sp['docPath']
        results = results.concat(paginate(sp, tag['posts'], perPage))
      }
      results.push(new File({
        'layout': 'tags',
        'docDir': site['siteConfig']['docDir'],
        'docPath': path.join(site['siteConfig']['tagDir'], 'index.html'),
        'title': 'tags',
        'comment': false,
        'reward': false
      }))
      return results
    })
  }
}

module.exports = Hikaru
