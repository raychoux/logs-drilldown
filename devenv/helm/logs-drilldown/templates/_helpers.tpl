{{- define "logs-drilldown.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{- define "logs-drilldown.fullname" -}}
{{- printf "%s" .Release.Name | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{- define "logs-drilldown.labels" -}}
helm.sh/chart: {{ printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | quote }}
app.kubernetes.io/name: {{ include "logs-drilldown.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
app.kubernetes.io/part-of: logs-drilldown-dev
{{- end -}}

{{- define "logs-drilldown.selectorLabels" -}}
app.kubernetes.io/name: {{ include "logs-drilldown.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end -}}
