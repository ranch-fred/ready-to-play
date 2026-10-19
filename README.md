# ReadyToPlay

A phone-friendly web app that helps student athletes figure out how serious an injury is, where to get care, and roughly when they can play again. ReadyToPlay does not replace a doctor or athletic trainer.

## Run it

```bash
npm install
npm run dev
```

## 3D body models

The 3D models in `public/models` are built from BodyParts3D by `scripts/build-anatomy.mjs`:

```bash
node scripts/build-anatomy.mjs <bodyparts3d-folder> public/models
```

The BodyParts3D folder needs `partof_element_parts.txt` and the unzipped `partof_BP3D_4.0_obj_99` meshes from the [BodyParts3D download page](https://dbarchive.biosciencedbc.jp/en/bodyparts3d/download.html).

## Credits

- 3D anatomy: BodyParts3D, © The Database Center for Life Science, licensed under [CC Attribution 4.0 International](https://dbarchive.biosciencedbc.jp/en/bodyparts3d/lic.html).
- Injury rules (`src/data/rules.json`) cite their medical sources inline.
