var React = require('react')
var ReactDOMServer = require('react-dom/server')
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

var matchRoute = function (e) {
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
            // https://cloud.tencent.com/developer/article/1032428
            let store = configureStore()
            let prefetchTasks = []
            for (let component of renderProps.components) {
                if (component && component.WrappedComponent && component.WrappedComponent.fetchData) {
                    const _tasks = component.WrappedComponent.fetchData(renderProps, store)
                    if (Array.isArray(_tasks)) {
                        prefetchTasks = prefetchTasks.concat(_tasks)
                    } else if (_tasks.then) {
                        prefetchTasks.push(_tasks)
                    }
                }
            }
            await Promise.all(prefetchTasks)
            let html = ReactDOMServer.renderToString(
                React.createElement(Provider, {
                    store
                }, React.createElement(RouterContext, renderProps))
            )
            ctx.body = baseTemplate.replace('{html}', html).replace('{__INITIAL_STATE__}', JSON.stringify(store.getState(), null, 4))
        } else {
            await next()
        }
    } catch (err) {
        ctx.status = 500
        ctx.body = err.message
    }
}