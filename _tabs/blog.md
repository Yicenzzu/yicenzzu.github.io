---
title: Blog
icon: fas fa-pen-nib
order: 1
permalink: /blog/
---

Notes on research, scientific computing, and life in academia.

{% assign blog_posts = site.posts | where_exp: 'post', 'post.hidden != true' %}
{% if blog_posts.size > 0 %}
{% for post in blog_posts %}
### [{{ post.title }}]({{ post.url | relative_url }})

{{ post.date | date: '%B %-d, %Y' }} · {{ post.excerpt | strip_html | truncate: 180 }}

{% endfor %}
{% else %}
New posts will appear here.
{% endif %}
