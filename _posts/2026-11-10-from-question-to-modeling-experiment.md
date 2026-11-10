---
title: "From a Research Question to a Modeling Experiment"
date: 2026-11-10 09:00:00 +0800
---

A useful modeling study begins with a question that can be answered by a clear comparison. Before changing a parameter or launching a simulation, write down the assumption you want to examine and the result that would help you interpret it.

## Make the comparison explicit

Choose a baseline case and a small number of variations. Keep the setup the same everywhere else so that the comparison remains understandable. For aerosol and atmospheric chemistry studies, that can mean recording which representation, reaction setting, or input dataset changes in each run.

## Decide what to inspect

Select a few outputs that connect directly to the question. Save the units, averaging period, and any filters alongside the results. A plot is easier to interpret later when its axes and processing steps are documented.

## Keep the run reproducible

Store the configuration file, code revision, and short run notes with each result. If the experiment is repeated on a different machine, these details make it easier to tell whether a difference came from the science setup or from the computing environment.

A compact experiment plan can save time: one question, one baseline, a small set of controlled comparisons, and a record of how each output was produced.
