'use strict'

/**
 * @module types
 */

/**
 * @description Site's data.
 */
class Site {
  /**
   * @param {String} siteDir
   * @property {Object} siteConfig
   * @property {Object} themeConfig
   * @property {File[]} posts
   * @property {File[]} pages
   * @property {File[]} assets
   * @property {File[]} files Generated by generator.
   * @property {Category[]} categories
   * @property {Number} categoriesLength Flattened categories length.
   * @property {Tag[]} tags
   * @property {Number} tagsLength Flattened tags length.
   * @return {Site}
   */
  constructor(siteDir) {
    this.siteDir = siteDir
    this.siteConfig = {}
    this.themeConfig = {}
    this.posts = []
    this.pages = []
    this.assets = []
    this.files = []
    this.categories = []
    this.categoriesLength = 0
    this.tags = []
    this.tagsLength = 0
  }
}

/**
 * @description File's data.
 */
class File {
  /**
   * @param {(String|Object)} docDir If it is an Object,
   * it will be assigned into file.
   * @param {String} srcDir Required if docDir is a String.
   * @param {String} srcPath Required if docDir is a String.
   * @property {String} srcDir
   * @property {String} srcPath
   * @property {String} docDir
   * @property {String} docPath Generated by renderer.
   * @property {Boolean} isBinary
   * @property {String} createdDate
   * @property {String} updatedDate
   * @property {String} zone
   * @property {String} title
   * @property {String} layout
   * @property {Boolean} comment
   * @property {Boolean} reward
   * @property {Buffer|String} raw Raw file content.
   * @property {String} text
   * @property {String} content Content after front-matter.
   * @property {String} type Avaliable for `page`, `post`, `asset`, `file`.
   * @property {Object} frontMatter
   * @property {Category[]} categories
   * @property {Tag[]} tags
   * @property {String} excerpt
   * @property {String} more Content after excerpt.
   * @property {Object} $ Cheerio context.
   * @property {File[]} posts Posts links to this page.
   * @property {TOC[]} toc Content toc.
   * @property {File[]} pageArray Generated by `paginate()`.
   * @property {Number} pageIndex Generated by `paginate()`.
   * @property {File} next Next post.
   * @property {File} prev Prev post.
   */
  constructor(docDir, srcDir, srcPath) {
    this.srcDir = srcDir
    this.srcPath = srcPath
    this.docDir = docDir
    this.docPath = null
    this.isBinary = false
    this.createdDate = null
    this.updatedDate = null
    this.zone = null
    this.title = null
    this.layout = null
    this.comment = null
    this.reward = null
    this.raw = null
    this.text = null
    this.content = null
    this.type = null
    this.frontMatter = {}
    this.categories = []
    this.tags = []
    this.excerpt = null
    this.more = null
    this.$ = null
    this.toc = []
    this.posts = []
    this.pageArray = []
    this.pageIndex = null
    this.next = null
    this.prev = null
    // Don't use utils here, or it will cause circular dependencies.
    if (typeof(docDir) === 'object' && docDir != null) {
      Object.assign(this, docDir)
    }
  }
}

/**
 * @description Categroy data.
 */
class Category {
  /**
   * @param {String} name
   * @param {File[]} posts
   * @param {Categroy[]} subs Sub categories.
   * @property {String} name
   * @property {File[]} posts
   * @property {Categroy[]} subs Sub categories.
   */
  constructor(name, posts = [], subs = []) {
    this.name = name
    this.posts = posts
    this.subs = subs
  }
}

/**
 * @description Tag data.
 */
class Tag {
  /**
   * @param {String} name
   * @param {File[]} posts
   * @property {String} name
   * @property {File[]} posts
   */
  constructor(name, posts = []) {
    this.name = name
    this.posts = posts
  }
}

/**
 * @description TOC data.
 */
class TOC {
  /**
   * @param {String} name
   * @param {String} archor HTML ID as archor,
   * @param {String} text Title text.
   * @param {TOC[]} subs Sub TOCs.
   * @property {String} name
   * @property {String} archor HTML ID as archor,
   * @property {String} text Title text.
   * @property {TOC[]} subs Sub TOCs.
   */
  constructor(name, archor, text, subs = []) {
    this.name = name
    this.archor = archor
    this.text = text
    this.subs = subs
  }
}

module.exports = {
  Site,
  File,
  Category,
  Tag,
  TOC
}
