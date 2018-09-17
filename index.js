var React = require('react')
var ReactDOMServer = require('react-dom/server')
var {
    createStore
} = require('redux')
var {
    Provider
} = require('react-redux')
var {
    match,
    RouterContext
} = require('react-router')
var fs = require('fs')

// FIXME:
var baseTemplate = fs.readFileSync(resolveApp('public/index.html')).toString()
var {
    routes,
    configureStore
} = require('./dist/server.bundle')

var matchRoute = function(e) {
    return new Promise((resolve, reject) => {
        match(e, (error, redirect, renderProps) => {
            if (error) {
                reject(error)
            } else {
                resolve({
                    redirect,
                    renderProps
                })
            }     
        })
    })
}

module.exports = async function (ctx, next) {
    try {
        var {
            redirect,
            renderProps
        } = await matchRoute({
            routes: routes,
            location: ctx.request.url
        })
        if (redirect) {
            ctx.status = 302
            ctx.redirect(redirect.pathname + redirect.search)
        } else if (renderProps) {
            ctx.status = 200
            var store = configureStore({
                'test/articles': {
                  fetching: false,
                  articles: [1,2,3]
                }
            })
            var html = ReactDOMServer.renderToString(
                React.createElement(Provider, {
                    store
                }, React.createElement(RouterContext,renderProps))
            )
            var initState = store.getState()
            ctx.body = baseTemplate.replace('{html}', html).replace('{__INITIAL_STATE__}', JSON.stringify(initState, null, 4))
        } else {
            await next()
        }
    } catch (err) {
        ctx.status = 500
        ctx.body = err.message
    }
}