#!/usr/bin/env python3
"""Refresh static file/listing dates from Git; never date HTML or thumbnail edits.

Run after committing changed downloads: python3 scripts/update-site-dates.py
Release dates are maintained separately in the page's version/changelog copy.
"""
import html
import re
import subprocess
from datetime import date
from functools import lru_cache
from pathlib import Path
from urllib.parse import unquote

ROOT = Path(__file__).resolve().parents[1]


def git(*args):
    return subprocess.check_output(['git', '-c', 'core.quotepath=false', *args], cwd=ROOT, text=True)


def stamp(day):
    value = date.fromisoformat(day)
    return f'<time datetime="{day}">{value.day} {value:%B %Y}</time>'


@lru_cache(None)
def file_history():
    # Read names once, without decoding every old card image to calculate a diff.
    history = git('log', '--format=DATE:%cs', '--name-status', '--find-renames=100%')
    records = []
    for record in history.split('DATE:')[1:]:
        lines = record.splitlines()
        records.append((lines[0], [line.split('\t') for line in lines[1:] if '\t' in line]))
    return records


@lru_cache(None)
def file_date(path):
    # Follow exact moves, but don't present a zero-change rename as an update.
    for day, changes in file_history():
        for change in changes:
            if change[0] == 'R100' and change[2] == path:
                path = change[1]
            elif change[0] in ('A', 'M') and change[1] == path:
                return day
    raise ValueError(f'No recorded content date for {path}')


def listing_date(url):
    dates = git('log', '--reverse', '--format=%cs', f'-S{url}', '--', 'index.html', 'extensions.html').splitlines()
    if not dates:
        raise ValueError(f'No recorded listing date for {url}')
    return dates[0]


def metadata(label, day, tag='p'):
    return f'<{tag} class="release-date" data-file-date>{label} {stamp(day)}</{tag}>'


def update(page):
    source = (ROOT / page).read_text()
    source = re.sub(r'\s*<(p|span) class="release-date" data-file-date>.*?</\1>', '', source)
    if page == 'cards.html':
        def card(match):
            block = match[0]
            path = unquote(html.unescape(re.search(r'href="([^"]+)"', block)[1]))
            return re.sub(r'\s*</a>', metadata('File updated', file_date(path), 'span') + '</a>', block)
        source = re.sub(r'<a class="card-item".*?</a>', card, source, flags=re.S)
    if page in ('themes.html', 'cards.html'):
        def download(match):
            path = unquote(html.unescape(match[2]))
            return '\n            ' + metadata('File updated', file_date(path)) + '\n            ' + match[0].lstrip()
        source = re.sub(r'\s*(<div class="preset-downloads"[^>]*>\s*<a href=")((?:theme|cards)/[^"?]+\.json)"', download, source)
    if page == 'extensions.html':
        def extension(match):
            return match[0] + '\n            ' + metadata('Listed', listing_date(match[1]))
        source = re.sub(r'<div class="ext-name"><a[^>]*href="([^"]+)"[^>]*>.*?</a></div>', extension, source)
    if page == 'index.html':
        def changelog(match):
            dates = git('log', '--reverse', '--format=%cs', f'-S{match[0]}', '--', 'index.html').splitlines()
            if not dates:
                raise ValueError(f'No recorded publication date for {match[0]}')
            return match[0] + '\n          ' + metadata('Published here', dates[0])
        source = re.sub(r'<h3 class="changelog-version">[^<]+</h3>', changelog, source)
        def previous(match):
            block = match[0]
            def link(item):
                path = unquote(html.unescape(item[1]))
                return item[0].replace('</a>', metadata('File updated', file_date(path), 'span') + '</a>')
            return re.sub(r'<a href="([^"]+)"[^>]*>.*?</a>', link, block, flags=re.S)
        source = re.sub(r'<div class="preset-downloads" id="(?:tee-)?previous-versions-list">.*?</div>', previous, source, flags=re.S)
    (ROOT / page).write_text(source)


if __name__ == '__main__':
    for page in ('index.html', 'cards.html', 'themes.html', 'extensions.html'):
        update(page)
        print(f'Updated recorded dates in {page}')
