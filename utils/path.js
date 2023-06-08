const path = require( 'path')
const common = require('../../lib/common/common')

const _path = common.getRootPath()

// 插件名
const pluginName = "StarRail-plugin"
// 插件根目录
const pluginRoot = path.join(_path, 'plugins', pluginName)
// 插件资源目录
const pluginResources = path.join(pluginRoot, 'resources')

exports._path = _path
exports.pluginName = pluginName
exports.pluginRoot = pluginRoot
exports.pluginResources = pluginResources
