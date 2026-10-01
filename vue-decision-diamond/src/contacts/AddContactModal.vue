<script setup lang="ts">
import { ref, useId, watch } from 'vue';
import { useForm } from 'vee-validate';
import * as yup from 'yup';
import {
  DexModal,
  DexModalContent,
  DexModalHeading,
  DexModalBody,
  DexInput,
  DexButton,
  DexTextarea,
  DexStack,
  DexButtonGroup,
  DexModalTrigger,
  DexModalFooter,
  DexCheckbox,
  DexInline,
  useNotification,
} from '@thryvlabs/dex-vue';

defineOptions({
  name: 'DexAddContactModal',
});

const open = ref(false);
const formId = useId();
const isSubmitting = ref(false);
const createAnother = ref(false);
const notification = useNotification();

const schema = yup.object({
  firstName: yup.string().required('First name is required'),
  lastName: yup.string().required('Last name is required'),
  email: yup.string().email('Invalid email').required('Email is required'),
  phone: yup.string(),
  company: yup.string(),
  title: yup.string(),
  notes: yup.string(),
});

const { handleSubmit, errors, defineField, resetForm } = useForm({
  validationSchema: schema,
});

const [firstName, firstNameAttrs] = defineField('firstName');
const [lastName, lastNameAttrs] = defineField('lastName');
const [email, emailAttrs] = defineField('email');
const [phone, phoneAttrs] = defineField('phone');
const [company, companyAttrs] = defineField('company');
const [title, titleAttrs] = defineField('title');
const [notes, notesAttrs] = defineField('notes');

watch(open, (isOpen) => {
  if (!isOpen) {
    createAnother.value = false;
    resetForm();
  }
});

const onSubmit = handleSubmit((data) => {
  isSubmitting.value = true;
  setTimeout(() => {
    notification.open({
      title: 'Contact added',
      description: `The contact "${data.firstName} ${data.lastName}" was added successfully`,
      variant: 'success',
    });

    if (createAnother.value) {
      resetForm();
    } else {
      open.value = false;
    }

    isSubmitting.value = false;
  }, 1000);
});
</script>

<template>
  <DexModal v-model:open="open">
    <DexModalTrigger>
      <slot name="trigger" />
    </DexModalTrigger>
    <DexModalContent>
      <DexModalHeading title="Add a new contact" />
      <DexModalBody>
        <form :id="formId" novalidate @submit="onSubmit">
          <DexStack gap="200" stretch>
            <DexInput
              v-model="firstName"
              v-bind="firstNameAttrs"
              label="First name"
              required
              :variant="errors.firstName ? 'danger' : 'default'"
              :message="errors.firstName"
            />
            <DexInput
              v-model="lastName"
              v-bind="lastNameAttrs"
              label="Last name"
              required
              :variant="errors.lastName ? 'danger' : 'default'"
              :message="errors.lastName"
            />
            <DexInput
              v-model="email"
              v-bind="emailAttrs"
              label="Email"
              required
              :variant="errors.email ? 'danger' : 'default'"
              :message="errors.email"
            />
            <DexInput v-model="phone" v-bind="phoneAttrs" label="Phone" />
            <DexInput v-model="company" v-bind="companyAttrs" label="Company" />
            <DexInput v-model="title" v-bind="titleAttrs" label="Title" />
            <DexTextarea v-model="notes" v-bind="notesAttrs" label="Notes" />
          </DexStack>
        </form>
      </DexModalBody>
      <DexModalFooter>
        <DexInline align-x="spread" align-y="center" stretch>
          <DexCheckbox v-model:checked="createAnother" label="Create another" />
          <DexButtonGroup align-x="right">
            <DexButton variant="transparent" @click="open = false">
              Cancel
            </DexButton>
            <DexButton
              variant="solid"
              type="submit"
              :form="formId"
              :loading="isSubmitting"
            >
              Add contact
            </DexButton>
          </DexButtonGroup>
        </DexInline>
      </DexModalFooter>
    </DexModalContent>
  </DexModal>
</template>
