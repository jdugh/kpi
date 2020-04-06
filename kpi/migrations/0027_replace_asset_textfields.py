# Generated by Django 2.2.7 on 2020-04-06 01:31

import django.contrib.postgres.fields.jsonb
from django.db import migrations
import jsonfield.fields

from kpi.management.commands.populate_asset_jsonbfields \
    import check_fields


def forwards(apps, schema_editor):
    check_fields(1000)


class Migration(migrations.Migration):

    dependencies = [
        ('kpi', '0026_asset_jsonbfields'),
    ]

    operations = [
        migrations.RunPython(
            forwards,
        ),
        migrations.RemoveField(
            model_name='asset',
            name='content',
        ),
        migrations.RemoveField(
            model_name='asset',
            name='summary',
        ),
        migrations.RemoveField(
            model_name='asset',
            name='_deployment_data',
        ),
        migrations.RenameField(
            model_name='asset',
            old_name='content_jsonb',
            new_name='content',
        ),
        migrations.RenameField(
            model_name='asset',
            old_name='summary_jsonb',
            new_name='summary',
        ),
        migrations.RenameField(
            model_name='asset',
            old_name='_deployment_data_jsonb',
            new_name='_deployment_data',
        ),
    ]
