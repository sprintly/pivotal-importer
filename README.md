# Pivotal Importer

This tool exists to import your Pivotal Tracker data into
[Sprintly](https://sprint.ly/).

## Usage

```sh
git clone https://github.com/sprintly/pivotal-importer.git
cd pivotal-importer
npm install
cp env{.sample,}.js
# edit env.js with your relevant data
node importer.js
```

## Caveats

You must have users created in your destination Sprintly product with
the same name as they have in Pivotal for the mapping to work. This is
because Pivotal doesn't expose emails or user ids through their
API. Support for some mechanism of mapping would be a welcome
contribution.

## Development

This was originally based off of [this
gist](https://gist.github.com/vanstee/1536300) from @vanstee (which,
itself, was based on a gist by @jmreidy). The big changes here have
been to add a test suite and introduce the `async` module which makes
it easier to test in isolation.

You can run tests with `npm test` or coverage with `npm run coverage`.

## Contact

If you have questions, feel free to send us an email at
support@sprint.ly

## License

MIT