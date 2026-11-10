---
title: "A Practical Note on Reproducible Data Analysis"
date: 2026-11-10 09:05:00 +0800
categories:
  - Research notes
tags:
  - Reproducibility
  - Data analysis
description: Small habits that keep a data analysis understandable months later.
cover: static/assets/img/posts/reproducible-data-analysis.jpg
cover_alt: Scientific visualization used as the cover for a note on reproducible data analysis
---

Research data analysis often involves several small decisions: how files are selected, how missing values are handled, which units are used, and how a figure is assembled. Writing those decisions down makes the analysis easier to revisit and easier for a collaborator to follow.

## Keep inputs and outputs distinct

Treat downloaded or model-generated source files as inputs. Write cleaned tables, summaries, and figures to separate output locations so the original data remain available for comparison.

## Record assumptions close to the code

A short script header can name the data source, units, time range, and expected output. Keep transformations visible in code, and use descriptive variable names for quantities that could otherwise be confused.

## Make figures traceable

Save the plotting script with the figure and include labels, units, and the selection criteria in the caption or notes. When a plot changes, this makes it clear which analysis step produced the update.

Reproducibility does not require a complicated system. A consistent folder structure, readable scripts, and a brief record of decisions provide a practical starting point for future work.
