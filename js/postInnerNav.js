;(function() {
  const body = document.querySelector('.article-entry')
  const headers = Array.from(body.querySelectorAll('h2,h3,h4,h5,h6'))
  const treeRoot = { children: [] }
  function getTagLevel(el) {
    const res = /^H(\d+)/.exec(el.tagName)
    return res && res[1]
  }
  let parent = treeRoot
  let nextParent
  for (let i = 0; i < headers.length; i++) {
    while (true) {
      if (
        parent === treeRoot ||
        getTagLevel(parent.el) < getTagLevel(headers[i])
      ) {
        nextParent = {
          parent,
          el: headers[i],
          children: []
        }
        parent.children.push(nextParent)
        parent = nextParent
        break
      } else {
        parent = parent.parent
      }
    }
  }
  function renderChildren(children) {
    return children
      .map(function(c) {
        return `<li><a href="#${
          c.el.id
        }">${c.el.textContent}</a>${c.children ? `<ul>${renderChildren(c.children)}</ul>` : ''}</li>`
      })
      .join('')
  }
  const fragment = '<ul>' + renderChildren(treeRoot.children) + '</ul>'
  const root = document.querySelector('.post-inner-nav')
  root.innerHTML = fragment
})()
