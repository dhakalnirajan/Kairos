<script setup lang="ts">
interface Props {
  title: string;
  count: number;
}

const props = defineProps<Props>();
</script>

<template>
  <card :title="title" :count="count">
    <h2>
      {{ title }}
    </h2>
    <p>
      Count: {{ count }}
    </p>
  </card>
</template>

<style scoped>
.card {
}

.h2 {
}

.p {
}
</style>
